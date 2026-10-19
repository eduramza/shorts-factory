"use client";
import {useEffect,useRef} from 'react';
export function Modal({titleId,onClose,children}:{titleId:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;dialog.showModal();return ()=>dialog.close();},[]);
 return <dialog ref={ref} className="modal-native" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}}>{children}</dialog>;
}
