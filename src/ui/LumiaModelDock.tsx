/**
 * AMR-02: compact owner-controlled Ollama brain selector in the composer dock.
 * Exact installed tags only. No speech, synthetic conversation, persistence,
 * downloads, Ollama HTTP exposure or alteration of other voice/VRM controls.
 */
import {useEffect,useRef,useState} from 'react'
import {controlLocalModel,watchLocalModels,type LocalModelState} from '../lib/bridge'

type Props={disabled:boolean;onBusyChange:(busy:boolean)=>void}

export function LumiaModelDock({disabled,onBusyChange}:Props){
  const [open,setOpen]=useState(false)
  const [state,setState]=useState<LocalModelState|null>(null)
  const [loading,setLoading]=useState(false)
  const [changing,setChanging]=useState('')
  const [notice,setNotice]=useState('')
  const root=useRef<HTMLDivElement>(null)
  const pending=useRef(false)
  useEffect(()=>watchLocalModels(setState),[])
  useEffect(()=>{
    if(!open)return
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
    const onPointer=(event:PointerEvent)=>{
      if(root.current&&!root.current.contains(event.target as Node))setOpen(false)
    }
    document.addEventListener('keydown',onKey)
    document.addEventListener('pointerdown',onPointer)
    return ()=>{
      document.removeEventListener('keydown',onKey)
      document.removeEventListener('pointerdown',onPointer)
    }
  },[open])
  useEffect(()=>()=>onBusyChange(false),[onBusyChange])

  const refresh=async()=>{
    if(pending.current)return
    setLoading(true)
    setNotice('')
    try{await controlLocalModel('list')}
    catch(err){setNotice(err instanceof Error?err.message:'No pude consultar Ollama.')}
    finally{setLoading(false)}
  }
  const choose=async(model:string)=>{
    if(pending.current||disabled||model===state?.active)return
    pending.current=true
    setChanging(model)
    setNotice('')
    onBusyChange(true)
    try{
      const latest=await controlLocalModel('switch',model)
      setNotice('Cerebro activo: '+latest.active)
    }catch(err){
      setNotice(err instanceof Error?err.message:'No pude cambiar el cerebro.')
    }finally{
      setChanging('')
      pending.current=false
      onBusyChange(false)
    }
  }
  return (
    <div ref={root} className="lumia-model-dock">
      <button type="button" className={'lumia-composer-icon-button lumia-model-trigger'+(open?' is-active':'')}
        aria-label="Seleccionar cerebro IA local"
        title={'Cerebro local: '+(state?.active||'consultar modelos')}
        aria-haspopup="true" aria-expanded={open}
        disabled={disabled||Boolean(changing)}
        onClick={()=>{
          if(open){setOpen(false);return}
          setOpen(true)
          void refresh()
        }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="3"/>
          <path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      {open&&(
        <div className="lumia-model-menu" role="group" aria-label="Modelos locales instalados">
          <div className="lumia-model-head">
            <span>CEREBRO LOCAL</span>
            <button type="button" aria-label="Actualizar modelos instalados"
              title="Actualizar lista de Ollama" disabled={loading||Boolean(changing)}
              onClick={()=>void refresh()}>↻</button>
          </div>
          <div className="lumia-model-current" title={state?.active||''}>
            Activo: <strong>{state?.active||'consultando…'}</strong>
          </div>
          {state?.installed.map((model)=>(
            <button key={model} type="button"
              className={'lumia-model-option'+(model===state.active?' is-current':'')}
              aria-pressed={model===state.active}
              disabled={disabled||Boolean(changing)||model===state.active}
              onClick={()=>void choose(model)}>
              <span className="lumia-model-led">{model===state.active?'●':'○'}</span>
              <span className="lumia-model-name">{model}</span>
              {model===state.active&&<span className="lumia-model-selected">ACTIVO</span>}
              {changing===model&&<span className="lumia-model-selected">PREPARANDO…</span>}
            </button>
          ))}
          {!state?.installed.length&&<div className="lumia-model-empty">
            {loading?'Consultando Ollama…':'No se encontraron modelos locales.'}
          </div>}
          {notice&&<div className="lumia-model-notice" role="status">{notice}</div>}
          <div className="lumia-model-foot">Solo modelos instalados · sin descarga automática</div>
        </div>
      )}
    </div>
  )
}
