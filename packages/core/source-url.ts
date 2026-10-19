export function canonicalYoutubeUrl(value:string){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('Use uma URL HTTPS pública do YouTube.');
 const host=url.hostname.toLowerCase();let id:string|null=null;
 if(host==='youtu.be')id=url.pathname.slice(1);
 else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host))id=url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:shorts|live)\/([^/]+)$/)?.[1]||null;
 if(!id||!/[A-Za-z0-9_-]{11}/.test(id)||id.length!==11)throw new Error('URL inválida. Use um vídeo individual do YouTube.');
 return 'https://www.youtube.com/watch?v='+id;
}
