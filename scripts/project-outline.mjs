import ts from 'typescript';

/** Index declared authoring classes and typed references; never execute project code. */
export function projectOutline(program) {
  if(!program)return [];
  const checker=program.getTypeChecker(),items=[],declarations=new Map();
  const sources=program.getSourceFiles().filter(file=>file.fileName.startsWith('/project/'));
  const text=node=>node&&(ts.isStringLiteralLike(node)||ts.isNumericLiteral(node))?node.text:undefined;
  const property=(node,key)=>ts.isObjectLiteralExpression(node??{})?node.properties.find(p=>p.name?.getText()===key||text(p.name)===key)?.initializer:undefined;
  const location=(file,node)=>({path:file.fileName.slice('/project/'.length),start:node.getStart(file),line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1});
  function entityType(type,seen=new Set()) {
    if(!type||seen.has(type))return false;seen.add(type);
    if(type.symbol?.name==='Entity'&&type.symbol.declarations?.some(d=>d.getSourceFile().fileName==='/sdk/core.d.ts'))return true;
    return (type.getBaseTypes?.()??[]).some(base=>entityType(base,seen));
  }
  for(const file of sources) {
    function visit(node) {
      if(ts.isClassDeclaration(node)&&node.name&&entityType(checker.getTypeAtLocation(node))) {
        const constructor=node.members.find(ts.isConstructorDeclaration);let args;
        function findSuper(child){if(ts.isCallExpression(child)&&child.expression.kind===ts.SyntaxKind.SuperKeyword)args=child.arguments;else ts.forEachChild(child,findSuper);}
        if(constructor)ts.forEachChild(constructor,findSuper);
        const definition=args?.[1],options=args?.[2]??definition;
        const item={...location(file,node.name),id:text(definition)??text(property(definition,'id'))??null,
          label:text(property(options,'label'))??node.name.text,className:node.name.text,behaviors:[],references:[]};
        for(const member of node.members)if(ts.isPropertyDeclaration(member)&&ts.isCallExpression(member.initializer??{})&&
          ts.isPropertyAccessExpression(member.initializer.expression)&&member.initializer.expression.name.text==='behaviorSlot') {
          const call=member.initializer;
          item.behaviors.push({...location(file,member),member:member.name.getText(file),id:text(call.arguments[0])??null,label:text(call.arguments[1])??text(call.arguments[0])??member.name.getText(file)});
        }
        function actions(child) {
          if(ts.isCallExpression(child)&&ts.isPropertyAccessExpression(child.expression)&&child.expression.name.text==='actions') {
            const receiver=child.expression.expression;
            if(ts.isPropertyAccessExpression(receiver)&&receiver.expression.kind===ts.SyntaxKind.ThisKeyword) {
              const behavior=item.behaviors.find(b=>b.member===receiver.name.text);if(behavior)Object.assign(behavior,location(file,child));
            }
          }
          ts.forEachChild(child,actions);
        }
        ts.forEachChild(node,actions);items.push(item);declarations.set(node,item);
      }
      ts.forEachChild(node,visit);
    }
    visit(file);
  }
  const seen=new Map(items.map(item=>[item,new Set()]));
  for(const file of sources) {
    function visit(node) {
      if(ts.isPropertyAccessExpression(node)) {
        const targets=checker.getTypeAtLocation(node).symbol?.declarations??[];
        for(const declaration of targets) {
          const item=declarations.get(declaration);if(!item||item.path===file.fileName.slice('/project/'.length))continue;
          let statement=node,category='引用';
          for(let parent=node.parent;parent;parent=parent.parent) {
            if(ts.isCallExpression(parent)&&ts.isPropertyAccessExpression(parent.expression)) {
              const name=parent.expression.name.text;if(name==='bind')category='资源';else if(name==='on')category='事件';else if(name==='actions'&&category==='引用')category='行为';
            }
            if(ts.isStatement(parent)){statement=parent;break;}
          }
          const at=location(file,node),key=at.path+':'+statement.getStart(file);
          if(seen.get(item).has(key))continue;seen.get(item).add(key);
          item.references.push({...at,category,text:statement.getText(file).replace(/\s+/g,' ').slice(0,160)});
        }
      }
      ts.forEachChild(node,visit);
    }
    visit(file);
  }
  return items;
}
