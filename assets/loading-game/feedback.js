/*
MIT License

Copyright (c) 2019 Frank Force

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

ZzFXMicro v1.4.0: adapted to accept a lazy audio context and a master gain.
Original source and revision: vendor/ZZFX-SOURCE.txt.
*/

(() => {
  'use strict';
  function createSynth(context,destination){
'use strict';
let // ZzFXMicro - Zuper Zmall Zound Zynth - v1.4.0 by Frank Force
zzfxV=.3,               // volume
zzfxX=context, // audio context
zzfx=                   // play sound
(p=1,k=.05,b=220,e=0,r=0,t=.1,q=0,D=1,u=0,y=0,v=0,z=0,l=0,E=0,A=0,F=0,c=0,w=1,m=0,B=0
,N=0)=>{let M=Math,d=2*M.PI,R=44100,G=u*=500*d/R/R,C=b*=(1-k+2*k*M.random(k=[]))*d/R,
g=0,H=0,a=0,n=1,I=0,J=0,f=0,h=N<0?-1:1,x=d*h*N*2/R,L=M.cos(x),Z=M.sin,K=Z(x)/4,O=1+K,
X=-2*L/O,Y=(1-K)/O,P=(1+h*L)/2/O,Q=-(h+L)/O,S=P,T=0,U=0,V=0,W=0;e=R*e+9;m*=R;r*=R;t*=
R;c*=R;y*=500*d/R**3;A*=d/R;v*=d/R;z*=R;l=R*l|0;p*=zzfxV;for(h=e+m+r+t+c|0;a<h;k[a++]
=f*p)++J%(100*F|0)||(f=q?1<q?2<q?3<q?4<q?(g/d%1<D/2)*2-1:Z(g**3):M.max(M.min(M.tan(g)
,1),-1):1-(2*g/d%2+2)%2:1-4*M.abs(M.round(g/d)-g/d):Z(g),f=(l?1-B+B*Z(d*a/l):1)*(4<q?
f:(f<0?-1:1)*M.abs(f)**D)*(a<e?a/e:a<e+m?1-(a-e)/m*(1-w):a<e+m+r?w:a<h-c?(h-a-c)/t*w:
0),f=c?f/2+(c>a?0:(a<h-c?1:(h-a)/c)*k[a-c|0]/2/p):f,N?f=W=S*T+Q*(T=U)+P*(U=f)-Y*V-X*(
V=W):0),x=(b+=u+=y)*M.cos(A*H++),g+=x+x*E*(a*a*d%2-1),n&&++n>z&&(b+=v,C+=v,n=0),!l||++I%l
||(b=C,u=G,n=n||1);X=zzfxX,p=X.createBuffer(1,h,R);p.getChannelData(0).set(k);b=X.
createBufferSource();b.buffer=p;b.connect(destination);b.start()}

    return zzfx;
  }
  const button=document.getElementById('sound-toggle');
  let context,master,synthesize,enabled=false,lastRub=-Infinity;
  const presets={
    land:[.62,.025,108,.002,.006,.15,0,1.4,-.12,0,0,0,0,.24,0,0,0,1,.012,0,-1100],
    perfect:[.58,.02,142,.002,.008,.19,0,1.2,-.09,0,0,0,0,.16,0,0,0,1,.012,0,-1600],
    miss:[.3,.04,78,.003,.008,.1,0,1.4,-.1,0,0,0,0,.4,0,0,0,1,.01,0,-950],
    rub:[.11,.08,780,.008,.015,.045,4,1,0,0,0,0,0,0,0,0,0,.55,.012,0,-1700],
    paper:[.14,.05,1050,.025,.03,.12,4,1,0,0,0,0,0,0,0,0,0,.6,.02,0,-2400]
  };
  function setEnabled(value){
    enabled=value;
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',enabled?'关闭操作音效':'开启操作音效');
    document.getElementById('sound-state').textContent=enabled?'开':'关';
    if(master)master.gain.setTargetAtTime(enabled?.4:0,context.currentTime,.012);
  }
  function play(kind){
    if(!enabled||!synthesize||context.state!=='running'||document.hidden)return;
    if(kind==='rub'){
      if(context.currentTime-lastRub<.14)return;
      lastRub=context.currentTime;
    }
    try{synthesize(...presets[kind]);}catch(_){setEnabled(false);}
  }
  button.addEventListener('click',async()=>{
    if(enabled){setEnabled(false);return;}
    try{
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext){button.hidden=true;return;}
      if(!context){
        context=new AudioContext();master=context.createGain();master.gain.value=0;
        master.connect(context.destination);synthesize=createSynth(context,master);
      }
      setEnabled(true);
      await context.resume();
      if(context.state!=='running'){setEnabled(false);return;}
      if(enabled)play('land');
    }catch(_){setEnabled(false);button.hidden=true;}
  });
  document.addEventListener('visibilitychange',()=>{
    if(master)master.gain.setTargetAtTime(document.hidden?0:enabled?.4:0,context.currentTime,.012);
  });
  window.beijianFeedback={play};
})();
