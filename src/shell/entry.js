if(new URLSearchParams(location.search).has('play')){
  import('./play.js').then(({startPlay})=>startPlay());
}else{
  import('./editor.js');
}
