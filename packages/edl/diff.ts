export type DiffEntry={path:string;before:unknown;after:unknown};
export function diffEdl(before:unknown,after:unknown,path=''):DiffEntry[]{
 if(JSON.stringify(before)===JSON.stringify(after))return [];
 if(before!==null&&after!==null&&typeof before==='object'&&typeof after==='object'){
  const a=before as Record<string,unknown>,b=after as Record<string,unknown>;
  return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(key=>diffEdl(a[key],b[key],path?path+'.'+key:key));
 }
 return [{path,before,after}];
}
