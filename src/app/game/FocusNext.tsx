'use client';
import {ArrowRight,Flag,TriangleAlert} from 'lucide-react';
import {focusNext} from './focus-next';
import '../focus-next.css';
export default function FocusNext({sim,onOpen}:{sim:any;onOpen:(view:string)=>void}){
 const next=focusNext(sim);
 return <button className={'focus-next'+(next.urgent?' is-urgent':'')} aria-label={next.label+' · '+next.detail} onClick={()=>onOpen(next.view)}>
  {next.urgent?<TriangleAlert size={17}/>:<Flag size={17}/>}<span><strong>{next.label}</strong><small>{next.detail}</small></span><ArrowRight size={16}/>
 </button>;
}
