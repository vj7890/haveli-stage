'use client'

import { useEffect, useRef } from 'react'
import { mountBlocking } from '@/lib/blocking/app'
import { SiteNav } from '@/components/site-nav'

/**
 * The blocking tool's markup. All behaviour lives in lib/blocking/app.js,
 * which is wired onto this DOM once it exists and torn down on unmount.
 */
export default function BlockingClient() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!root.current) return
    document.documentElement.classList.add('viewer-page')
    const off = mountBlocking(root.current)
    return () => { off(); document.documentElement.classList.remove('viewer-page') }
  }, [])

  return (
    <div ref={root} className="blk">
      <div className="app">
        <div className="top">
          <SiteNav />
          <button type="button" className="tbtn" id="btnRoles">Roles</button>
          <button type="button" className="tbtn" id="btnList">Cue list</button>
          <button type="button" className="tbtn" id="btnSetup">Seating</button>
          <button type="button" className="tbtn" id="btnPrint">Print</button>
          <div className="spacer" />
          <input className="who" id="who" placeholder="Your name" />
          <button type="button" className="tbtn" id="btnShare">Share</button>
          <button type="button" className="tbtn" id="btnBackup">Backup</button>
          <button type="button" className="tbtn" id="btnImport">Import</button>
          <input type="file" id="importFile" accept="application/json" style={{ display: 'none' }} />
          <button type="button" className="tbtn key" id="btnPng">Export…</button>
          <div className="sync" id="sync">local only</div>
        </div>

        <div className="rail">
          <div className="railhead"><span>Sections &amp; cues</span><span id="sceneCount" /></div>
          <div className="scenes" id="scenes" />
          <div className="railfoot">
            <button type="button" className="tbtn" id="btnAddCue">Add cue</button>
            <button type="button" className="tbtn" id="btnDupCue">Duplicate</button>
            <button type="button" className="tbtn" id="btnAddSec">Add section</button>
            <button type="button" className="tbtn" id="btnDelCue">Delete cue</button>
            <button type="button" className="tbtn" id="btnLoad" style={{ gridColumn: '1 / -1' }}>Load cue sheet…</button>
          </div>
        </div>

        <div className="stage-area">
          <div className="tabs">
            <button type="button" className="tab on" data-surface="stage">Stage</button>
            <button type="button" className="tab" data-surface="hall">Hall</button>
            <div className="toolset">
              <button type="button" className="zbtn" id="btnZoomOut">−</button>
              <button type="button" className="zbtn" id="btnZoomIn">+</button>
              <button type="button" className="zbtn" id="btnFit">fit</button>
              <label className="chk"><input type="checkbox" id="optSnap" defaultChecked /> Snap</label>
              <label className="chk"><input type="checkbox" id="optLabels" defaultChecked /> Labels</label>
              <label className="chk"><input type="checkbox" id="optGhost" /> Previous cue</label>
              <button type="button" className="tbtn" id="btnArrow">Draw move</button>
              <button type="button" className="tbtn" id="btnClear">Clear</button>
            </div>
          </div>
          <div className="canvaswrap"><div className="sheet" id="sheet" /></div>
        </div>

        <div className="side">
          <div className="sec">
            <h3>Section</h3>
            <div className="row2">
              <div className="field"><label>Code</label><input id="fSecCode" placeholder="OPEN" /></div>
              <div className="field"><label>Name</label><input id="fSecTitle" placeholder="Opening" /></div>
            </div>
            <div className="field"><label>Script doc link</label><input id="fScript" placeholder="https://docs.google.com/…" /></div>
          </div>
          <div className="sec">
            <h3>Cue</h3>
            <div className="row2">
              <div className="field"><label>Cue no.</label><input id="fNo" placeholder="17" /></div>
              <div className="field"><label>Time</label><input id="fTime" placeholder="5:52 PM · 3:00" /></div>
            </div>
            <div className="field"><label>Item</label><input id="fTitle" placeholder="Speech 1" /></div>
            <div className="field"><label>Presenters</label><input id="fPres" placeholder="Who is on" /></div>
            <div className="field"><label>Props</label><textarea id="fProps" placeholder="headset mic, card" /></div>
            <div className="field"><label>Notes for the floor</label><textarea id="fNotes" placeholder="Entrances, cues, anything the marshals need." /></div>
          </div>
          <div className="sec">
            <h3>Place a marker</h3>
            <div className="palette" id="palette" />
          </div>
          <div className="sec" id="inspector"><h3>Selected</h3><div className="empty">Pick a role, then click the plan.</div></div>
        </div>

        <div className="status">
          <span id="stPos">—</span>
          <span id="stMode">Select</span>
          <span className="hint">wheel = zoom · shift-drag or right-drag = pan · Alt-drag = copy · Delete = remove</span>
        </div>
      </div>

      <div className="toast" id="toast" />
      <div className="modal" id="modal"><div className="card">
        <h2 id="mTitle" /><p id="mSub" /><div id="mBody" />
        <div className="cardfoot" id="mFoot" />
      </div></div>
      <div className="printroot" id="printRoot" />
    </div>
  )
}
