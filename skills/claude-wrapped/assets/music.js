// Generative soundtrack (Web Audio, no files): one track per slide, intensity follows the story arc.
window.wrappedMusic=(()=>{
const C={I:[0,4,7],i:[0,3,7],ii:[2,5,9],iii:[4,7,11],IV:[5,9,12],iv:[5,8,12],V:[7,11,14],v:[7,10,14],vi:[9,12,16],bVI:[8,12,15],bVII:[10,14,17]};
// [title, bpm, root midi, progression, intensity 0-1]
const T={first:['First Pour',84,48,'I V vi IV',.15],playlist:['On Repeat',96,50,'I vi IV V',.35],switch:['New Instrument',100,45,'i bVI bVII i',.3],months:['Crescendo',108,48,'vi IV I V',.6],built:['The Build',112,50,'I iii IV V',.65],ramp:['Skill Ramp',116,52,'IV V vi I',.7],busiest:['Main Character',124,45,'i bVII bVI bVII',1],streak:['The Streak',120,48,'I V vi IV',.85],clock:['Peak Hour',92,53,'ii V I vi',.3],agents:['On Their Own',126,45,'i iv bVI bVII',.95],tools:['Backstage',118,47,'i bVII bVI v',.8],models:['Long Encore',110,50,'IV I V vi',.55],projects:['Three Stages',120,48,'I V vi IV',.85],spotlights:['After Hours',100,45,'i bVI bVII iv',.5],spotlights2:['Deep Cuts',112,50,'vi IV I V',.75],receipt:['Last Check',80,48,'IV V I I',.2]};
const btn=document.getElementById('sound'),label=document.getElementById('sound-label');
let ctx,master,noise,timer,trk=T.first,num=1,step=0,next=0,on=false,muted=false;
try{muted=localStorage.getItem('wrapped-sound')==='off'}catch(e){}
const hz=m=>440*2**((m-69)/12);
function tone(type,m,t,d,v,cut,a=.01){const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type=type;o.frequency.value=hz(m);f.frequency.value=cut;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(f).connect(g).connect(master);o.start(t);o.stop(t+d+.05)}
function kick(t){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);g.gain.setValueAtTime(.55,t);g.gain.exponentialRampToValueAtTime(.0001,t+.28);o.connect(g).connect(master);o.start(t);o.stop(t+.3)}
function hat(t){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05);s.connect(f).connect(g).connect(master);s.start(t);s.stop(t+.06)}
function play(s,t){const[,bpm,root,prog,x]=trk,ch=prog.split(' '),c=C[ch[(s>>4)%ch.length]],st=s%16,sp=15/bpm;
if(st===0)c.forEach(n=>tone('triangle',root+12+n,t,sp*16,.045,1500,.4));
if(st===0||st===8||(x>.4&&(st===6||st===14)))tone('triangle',root-12+c[0],t,sp*3,.2,800);
if(x>.25&&st%2===0)tone('square',root+24+c[[0,1,2,1][st/2%4]]+(st>7?12:0),t,sp*1.6,.03,2400);
if(x>.5&&st%4===0)kick(t);
if(x>.7&&st%4===2)hat(t)}
function tick(){while(next<ctx.currentTime+.12){play(step,next);next+=15/trk[1];step=(step+1)%64}}
function show(){btn.setAttribute('aria-pressed',String(on));label.textContent=on?String(num).padStart(2,'0')+' \u00b7 '+trk[0]:muted?'Sound off':'Tap for sound';btn.setAttribute('aria-label',on?'Now playing '+trk[0]+'. Mute soundtrack':'Play soundtrack')}
async function start(){if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;ctx=new A();master=ctx.createGain();const comp=ctx.createDynamicsCompressor();master.connect(comp).connect(ctx.destination);noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
on=true;await ctx.resume();const n=ctx.currentTime;master.gain.cancelScheduledValues(n);master.gain.setValueAtTime(0,n);master.gain.linearRampToValueAtTime(.6,n+.6);next=n+.05;step=0;clearInterval(timer);timer=setInterval(tick,25);show()}
function stop(){on=false;show();if(!ctx)return;clearInterval(timer);master.gain.setTargetAtTime(0,ctx.currentTime,.08);setTimeout(()=>{if(!on)ctx.suspend()},400)}
btn.addEventListener('click',()=>{muted=on;try{localStorage.setItem('wrapped-sound',muted?'off':'on')}catch(e){}on?stop():start()});
function first(e){if(e.target.closest&&e.target.closest('#sound'))return;document.removeEventListener('pointerdown',first);document.removeEventListener('keydown',first);if(!muted&&!on)start()}
document.addEventListener('pointerdown',first);document.addEventListener('keydown',first);
document.addEventListener('visibilitychange',()=>{if(!ctx||!on)return;if(document.hidden){clearInterval(timer);ctx.suspend()}else start()});
show();
return{to(name,i){trk=T[name]||trk;num=i+1;step=0;if(on)show()}}
})();
