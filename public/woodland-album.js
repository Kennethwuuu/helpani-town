let database;
export function openAlbum() {
  if (database) return database;
  database = new Promise((resolve,reject) => {
    const request=indexedDB.open('helpani-woodland-album',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error('浏览器存储不可用'));
    request.onblocked=()=>reject(new Error('请关闭旧版相册页面后重试'));
  }).catch((error)=>{database=null;throw error;});
  return database;
}
export async function savePhoto(photo) {
  const db=await openAlbum();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('photos','readwrite');
    transaction.objectStore('photos').put({id:photo.id,createdAt:photo.createdAt,snapshot:photo.snapshot,species:photo.species||'red-panda',blob:photo.blob,medal:photo.medal || null});
    transaction.oncomplete=()=>resolve(photo.id);
    transaction.onerror=transaction.onabort=()=>reject(transaction.error || new Error('浏览器空间不足或存储不可用'));
  });
}
export async function listPhotos() {
  const db=await openAlbum();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('photos','readonly'), request=transaction.objectStore('photos').getAll();
    request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
    request.onerror=()=>reject(request.error);
  });
}
