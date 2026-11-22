// Builds the slides from W (stats from scripts/wrapped_stats.py + W.story written by Claude). A slide with no data is left out.
(()=>{
const W=/*WRAPPED_DATA*/null;
const story=document.querySelector('.story');
if(!W){story.innerHTML='<section class="slide" data-slide="first"><div class="inner"><h1 class="small">No data yet</h1><p class="caption">Run scripts/render.py to fill this page.</p></div></section>';return}
const S=W.story||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>Number(n||0).toLocaleString('en-US');
const parts=n=>n>=1e9?[Math.round(n/1e8)/10,1,'B']:n>=1e6?[Math.round(n/1e6),0,'M']:n>=1e3?[Math.round(n/1e3),0,'K']:[n,0,''];
const tok=n=>n>=1e9?(n/1e9).toFixed(n>=1e10?1:2)+'B':n>=1e6?Math.round(n/1e6)+'M':n>=1e3?Math.round(n/1e3)+'K':String(n||0);
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const D=s=>{const[y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d||1)};
const md=s=>s?MON[D(s).getMonth()]+' '+D(s).getDate():'';
const my=s=>(MON[D(s).getMonth()]+' '+D(s).getFullYear()).toUpperCase();
const wd=s=>D(s).toLocaleDateString('en-US',{weekday:'long'});
const long=s=>D(s).toLocaleDateString('en-US',{month:'long',day:'numeric'});
const mn=k=>MON[+k.slice(5,7)-1];
const model=id=>{const m=String(id).replace(/^claude-/,'').replace(/-\d{8}$/,'').split('-'),i=m.findIndex(x=>/^[a-z]/i.test(x));if(i<0)return String(id);const f=m[i],v=m.filter((x,j)=>j!==i).join('.');return f[0].toUpperCase()+f.slice(1)+(v?' '+v:'')};
const tally=(v,dc,sf,tag='span',cls='stat')=>`<${tag} class="${cls} tally" data-target="${v}" data-decimals="${dc}" data-suffix="${esc(sf)}">${Number(v).toLocaleString('en-US',{minimumFractionDigits:dc,maximumFractionDigits:dc})}${esc(sf)}</${tag}>`;
const detail=rows=>rows.length?`<div class="detail">${rows.map(([k,v])=>`<div class="receipt-label"><span>${esc(k)}</span><span class="dots">..............................</span><span>${esc(v)}</span></div>`).join('')}</div>`:'';
const spot=(k,big,h,p)=>`<div class="spot"><div class="k">${esc(k)}</div><strong class="big">${esc(big)}</strong><h2>${esc(h)}</h2><p>${esc(p)}</p></div>`;
const slides=[],add=(key,title,body)=>slides.push([key,title,body]);
const year=String(W.range&&W.range.end||'').slice(0,4);
const who=[`Claude Wrapped ${year}`,S.name].filter(Boolean).join(' \u00b7 ');

add('first','THE FIRST POUR',`<p class="kicker">${esc(who)}</p><h1 class="medium">Your year began on<span class="stat">${md(W.first_session)}</span></h1><p class="caption">${esc(S.intro||`${N(W.sessions)} sessions and ${N(W.prompts)} prompts later, here is your year with Claude.`)}</p>${detail([['FIRST SESSION',W.first_session],...(S.extra_firsts||[]).map(x=>[String(x.label).toUpperCase(),x.date])])}<p class="nav-hint">A year of work, one prompt at a time \u00b7 tap or swipe to begin</p>`);

const tw=W.title_words||[];
if(tw.length>=3)add('playlist','THE PLAYLIST',`<h1 class="medium">Your work had a few recurring tracks</h1><div class="tag-cloud" aria-label="Most common words in session titles">${tw.map(t=>`<span class="tag" style="--weight:${Math.round(t.count/tw[0].count*36)}">${esc(t.word)}<strong>${N(t.count)}</strong></span>`).join('')}</div><p class="caption">&quot;${esc(tw[0].word)}&quot; was on repeat across your session titles.</p>${detail([['TOP TITLE WORD',`${String(tw[0].word).toUpperCase()} - ${N(tw[0].count)}`]])}`);

if(S.switch&&S.switch.date)add('switch','A NEW INSTRUMENT',`<h1 class="medium">${md(S.switch.date)}: ${esc(S.switch.title)}</h1><p class="caption">${esc(S.switch.caption||'')}</p>${detail([[S.switch.label||'THE SWITCH',S.switch.date]])}`);

const ms=W.months||[];
if(ms.length>=2){const mx=Math.max(...ms.map(m=>m.tokens))||1,pk=ms.find(m=>m.tokens===mx),cols=['var(--bar-blue)','var(--bar-fog)','var(--bar-silver)','var(--bar-coral)'],[v,dc,sf]=parts(mx),notes=Object.entries(S.month_notes||{}).filter(([k])=>ms.some(m=>m.month===k)).sort();
add('months','THE MONTHLY CRESCENDO',`<h1 class="medium">${D(pk.month).toLocaleDateString('en-US',{month:'long'})} turned the volume up${tally(v,dc,sf)}</h1><div class="bar-chart${notes.length?' has-rows':''}${ms.length>12?' dense':''}" role="img" aria-label="Tokens by month: ${ms.map(m=>mn(m.month).toUpperCase()+' '+tok(m.tokens)).join(', ')}"><div class="bars">${ms.map((m,i)=>{const h=m.tokens/mx*100;return `<div class="bar-col"><div class="bar${h<30?' low':''}" style="--height:${h.toFixed(1)}%;--bar:${m===pk?'var(--lemon)':cols[i%4]}"><b>${tok(m.tokens)}</b></div><span class="bar-label">${mn(m.month).toUpperCase()}</span></div>`}).join('')}</div></div>${notes.length?`<div class="mrows">${notes.map(([k,t])=>`<div class="mrow"><b>${mn(k).toUpperCase()}</b><span>${esc(t)}</span></div>`).join('')}</div>`:''}${detail([[`${mn(pk.month).toUpperCase()} TOKENS`,tok(mx)]])}`)}

if(S.built&&S.built.length)add('built','THE THINGS YOU MADE',`<h1 class="small">What you built</h1><p class="caption">${esc(S.built_caption||'Skills, agents and tools that now do work for you.')}</p><div class="cards">${S.built.slice(0,6).map(b=>`<div class="card"><div class="card-top"><strong>${esc(b.title)}</strong><span>${esc(b.when||'')}</span></div><p>${esc(b.what||'')}</p></div>`).join('')}</div>${detail([S.systems_built!=null&&['SYSTEMS CREATED',N(S.systems_built)],W.pull_requests&&['PULL REQUESTS',N(W.pull_requests)]].filter(Boolean))}`);

const FL={mcp:'First connector (MCP)',plan_mode:'First plan mode',subagent:'First subagent',skill:'First skill',commit:'First commit',pull_request:'First pull request',worktree:'First worktree'};
const tl=[...(S.eras||[]).map(e=>({d:e.date,hl:1,t:e.label})),...Object.entries(W.firsts||{}).filter(([,d])=>d).map(([k,d])=>({d,hl:0,t:FL[k]||k}))].sort((a,b)=>String(a.d).localeCompare(b.d)||b.hl-a.hl);
if(tl.length>=3||W.work_per_prompt_growth)add('ramp','THE SKILL RAMP',`<h1 class="small">How your building grew</h1>${W.work_per_prompt_growth?`<div class="lev">${tally(W.work_per_prompt_growth,1,'x','strong','')}<span>more work per prompt than when you started</span></div>`:''}<p class="caption">${esc(S.ramp_caption||'From typing every request, to skills and subagents, to work that runs on its own.')}</p><ol class="timeline">${tl.map(x=>x.hl?`<li class="tl hl"><span>${my(x.d)}</span><b>${esc(x.t)}</b></li>`:`<li class="tl"><span>${md(x.d)}</span><span>${esc(x.t)}</span></li>`).join('')}</ol>`);

const b=W.busiest_day;
if(b){const[v,dc,sf]=parts(b.tokens);add('busiest','MAIN-CHARACTER ENERGY',`<p class="kicker">${wd(b.date)} - ${long(b.date)}, ${b.date.slice(0,4)}</p><h1 class="medium">A day with main-character energy${tally(v,dc,sf)}</h1><p class="caption">One ${wd(b.date)} carried the heaviest load of your year.</p><div class="two-stats"><div>${tally(b.prompts,0,'','strong','')}<span>prompts</span></div><div><strong>${wd(b.date)}</strong><span>${long(b.date)}</span></div></div>${detail([['DAY TOKENS',tok(b.tokens)],['DAY PROMPTS',N(b.prompts)]])}`)}

const st=W.streak;
if(st&&st.days>=2)add('streak','THE STREAK WAS REAL',`<h1 class="medium">One more day became a long run${tally(st.days,0,' days')}</h1><p class="caption">${N(st.days)} consecutive days with at least one prompt.</p><p class="note">ENDING ${md(st.end).toUpperCase()} ${st.end.slice(0,4)}</p>${detail([['LONGEST STREAK',st.days+' DAYS'],['LAST DAY',st.end]])}`);

const hs=W.hours||[],hm=Math.max(0,...hs);
if(hm){const h=hs.indexOf(hm),h12=(h%12||12)+(h<12?'A':'P'),name=h===12?'Noon':h===0?'Midnight':(h%12||12)+(h<12?' AM':' PM'),title=h>=5&&h<12?'MORNING PERSON':h>=12&&h<14?'LUNCH-HOUR POWER USER':h>=14&&h<18?'AFTERNOON ENGINE':h>=18&&h<22?'EVENING SHIFT':'NIGHT OWL';
add('clock',title,`<h1 class="medium">${name} was your hour${tally(hm,0,'')}</h1><p class="caption">${h===12?'Your busiest hour came with a side of lunch.':`More prompts landed at ${name} than at any other hour.`}</p><div class="histogram" role="img" aria-label="Prompts by hour, local time. ${name} is the busiest hour with ${N(hm)} prompts"><div class="hist-bars">${hs.map((c,i)=>`<i${i===h?' class="peak"':''} style="--height:${(c/hm*100).toFixed(1)}%"></i>`).join('')}</div><div class="hist-labels"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div></div>${detail([['PEAK HOUR - LOCAL TIME',`${h12} - ${N(hm)}`]])}`)}

if(W.automated_sessions)add('agents','WORK IN MOTION',`<h1 class="medium">${tally(W.automated_sessions,0,'')} sessions ran on their own</h1><p class="caption">${N(W.automated_sessions)} of ${N(W.sessions)} sessions started without you typing in a terminal.</p>${detail([['SESSIONS STARTED BY AUTOMATION',N(W.automated_sessions)],['ALL SESSIONS',N(W.sessions)]])}`);

const t=W.tools||[];
if(t.length)add('tools','THE TOOLS IN HEAVY ROTATION',`<h1 class="medium">${esc(t[0].name)} led the backstage${tally(t[0].calls,0,'')}</h1><p class="caption">A familiar crew kept the backstage humming.</p><div class="tool-list">${t.slice(0,3).map(x=>`<div class="tool-row"><b>${esc(x.name)}</b><span>${N(x.calls)} CALLS</span></div>`).join('')}</div>${detail([['TOP TOOL',String(t[0].name).toUpperCase()]])}`);

const mo=W.models||[];
if(mo.length)add('models','YOUR MODEL LINEUP',`<h1 class="medium">The headliner had a long encore</h1><p class="caption">${esc(model(mo[0].name))} led the bill${mo[1]?`, with ${esc(model(mo[1].name))} as the opening act`:''}.</p><div class="model-poster">${mo.slice(0,2).map(x=>`<div><strong>${esc(model(x.name))}</strong><span>${N(x.requests)} REQUESTS</span></div>`).join('')}</div>${detail([['TOP MODEL',model(mo[0].name).toUpperCase()]])}`);

const pj=(W.projects||[]).slice(0,3).map(p=>({...p,name:(S.project_names||{})[p.name]||p.name}));
if(pj.length)add('projects','THE PROJECTS THAT FILLED THE SETLIST',`<h1 class="medium">${['One big stage','Two big stages','Three big stages'][pj.length-1]} hosted the work</h1>${W.projects_share?`<p class="caption">${pj.length>1?'Together they':'It'} held ${Math.round(W.projects_share*100)}% of your tokens.</p>`:''}<div class="stages">${pj.map(p=>`<div class="stage"><span>${esc(String(p.name).toUpperCase())}</span><strong>${tok(p.tokens)}</strong></div>`).join('')}</div>${detail([['TOP STAGE',String(pj[0].name).toUpperCase()]])}`);

const tw2=W.top_word,lp=W.latest_prompt,ls=W.longest_session,bs=W.biggest_session,mf=W.most_edited_file;
const sp1=[tw2&&spot('Your most-typed word',N(tw2.count)+'x',`"${tw2.word}"`,(tw2.runners||[]).length?`Ahead of ${tw2.runners.map(r=>`"${r.word}" (${N(r.count)})`).join(' and ')}.`:''),
lp&&spot('Latest night',lp.time,long(lp.date),'The latest prompt of your year.'),
ls&&spot('Longest session',ls.hours+' hrs',ls.title||'Untitled session',`One session kept open for ${ls.hours} hours.`)].filter(Boolean);
if(sp1.length)add('spotlights','SPOTLIGHTS',`<h1 class="small">Fun spotlights</h1><p class="caption">A few things only your history could say.</p><div class="spots">${sp1.join('')}</div>`);
const sp2=[bs&&spot('Biggest session',tok(bs.tokens)+' tokens',bs.title||'Untitled session',`One session, ${tok(bs.tokens)} tokens.`),
mf&&spot('Most-edited file',N(mf.edits)+' edits',mf.name,mf.runner?`The file Claude touched most, ahead of ${mf.runner.name} at ${N(mf.runner.edits)}.`:'The file Claude touched most.')].filter(Boolean);
if(sp2.length)add('spotlights2','MORE SPOTLIGHTS',`<h1 class="small">More spotlights</h1><p class="caption">A few more from the logbook.</p><div class="spots">${sp2.join('')}</div>`);

const lines=[['Sessions',N(W.sessions)],['Prompts',N(W.prompts)],b&&['Busiest day',`${wd(b.date).slice(0,3)} ${md(b.date)}`],st&&['Streak',st.days+' days'],S.systems_built!=null&&['Systems built',N(S.systems_built)],W.pull_requests&&['Pull requests',N(W.pull_requests)],t[0]&&['Top tool',t[0].name],mo[0]&&['Top model',model(mo[0].name)],W.novels&&['Novels of output',`~${N(W.novels)} (estimate)`]].filter(Boolean);
const head=[S.org,`CLAUDE WRAPPED ${year}`+(S.name?' \u00b7 '+S.name:'')].filter(Boolean),total=`${tok(W.tokens_total)} TOKENS`;
const text=[head.join(' \u00b7 '),...lines.map(([k,v])=>k+': '+v),'TOTAL: '+total,'Thank you for dining with Claude'].join('\n');
add('receipt','THE LAST CHECK',`<h1>${W.novels?'A year, in novels':'A year, on one receipt'}</h1><p class="caption">A library-sized year of thinking, drafting, and building.</p><div class="receipt" id="receipt"><div class="receipt-head">${head.map(esc).join('<br>')}</div>${lines.map(([k,v])=>`<div class="receipt-line"><span>${esc(k)}</span><i class="dots"></i><span>${esc(v)}</span></div>`).join('')}<div class="receipt-total">${total}</div><p class="receipt-foot">Thank you for dining with Claude</p><p class="receipt-source mono">Source: local Claude Code transcripts, ${esc(W.range&&W.range.start)} to ${esc(W.range&&W.range.end)}.${S.source_note?' '+esc(S.source_note):''}</p></div><button class="copy-btn" type="button" id="copy-summary">Copy summary</button><textarea class="copy-fallback" id="receipt-copy" readonly aria-label="Plain text receipt summary">${esc(text)}</textarea><p class="nav-hint" id="copy-status" aria-live="polite">${esc(head.join(' \u00b7 '))}</p>`);

const pad=n=>String(n).padStart(2,'0');
story.innerHTML=slides.map(([k,title,body],i)=>`<section class="slide" data-slide="${k}"><div class="inner"><p class="eyebrow">SLIDE ${pad(i+1)} / ${pad(slides.length)} \u00b7 ${esc(title)}</p>${body}</div></section>`).join('');
document.title=`Claude Wrapped ${year}`;story.setAttribute('aria-label',`Claude Wrapped ${year} story`);
})();
