/* Coffeebreak link v3: PeerJS + ntfy signalling in parallel, own WebRTC line with TURN */
(function(){
var L=window.CBLink={},o,sid=Math.random().toString(36).slice(2,10),lines={},peer,pid=null,pk=0,es,ICE;
var HARD=[{"urls":["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302","stun:stun2.l.google.com:19302","stun:stun3.l.google.com:19302","stun:stun4.l.google.com:19302"]},{"urls":"stun:stun.cloudflare.com:3478"},{"urls":"stun:global.stun.twilio.com:3478"},{"urls":"stun:stun.nextcloud.com:443"},{"urls":"turn:global.relay.metered.ca:80","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"},{"urls":"turn:global.relay.metered.ca:80?transport=tcp","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"},{"urls":"turn:global.relay.metered.ca:443","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"},{"urls":"turns:global.relay.metered.ca:443?transport=tcp","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"}];
ICE={iceServers:HARD};
try{var c=JSON.parse(localStorage.getItem('cbl_ice')||'null');if(c&&c.length)ICE={iceServers:c}}catch(e){}
fetch('https://songwriterkaz.github.io/coffeebreak-ice/ice.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.iceServers&&j.iceServers.length){ICE={iceServers:j.iceServers};localStorage.setItem('cbl_ice',JSON.stringify(j.iceServers))}}).catch(function(){});
L.lines=lines;L.sid=sid;
function now(){return Date.now()}var T0=Date.now();L.log=[];function lg(x){L.log.push(((now()-T0)/1000).toFixed(2)+' '+x)}
function topic(n){return o.prefix+'sig-'+n}
function base(id){return id.slice(o.prefix.length).split('-')[0]}
function line(n){return lines[n]||(lines[n]={name:n,pcs:{},gen:0,open:false,hello:0,aIdx:0})}
function status(l,t,ok){l.st=t;o.onStatus&&o.onStatus(l.name,t,!!ok)}
L.init=function(opt){o=opt;listen();startPeer(0);setInterval(tick,1000)};
L.want=function(n,main){if(!n||n==o.me)return;var l=line(n);if(main)l.main=true;if(!l.t0){l.t0=now();l.next=0;status(l,'Finding '+n+'\u2026')}tick()};
L.isOpen=function(n){return !!(lines[n]&&lines[n].open)};
L.retry=function(n){var l=line(n);closeAll(l);l.t0=now();l.next=0;l.hello=0;l.stuck=false;l.aIdx=0;l.rpid=null;status(l,'Finding '+n+'\u2026');try{if(!peer||peer.destroyed||peer.disconnected)startPeer(pk)}catch(e){}tick()};
L.send=function(n,m){var l=lines[n];if(!l)return false;if(l.dc&&l.dc.readyState=='open'){l.dc.send(JSON.stringify(m));return true}if(l.conn&&l.conn.open){l.conn.send(m);return true}return false};
L.setTrack=function(n,track){var l=lines[n];if(!l||!l.pc)return Promise.reject();var tr=l.pc.getTransceivers().filter(function(t){return t.receiver.track&&t.receiver.track.kind=='audio'})[0];if(!tr)return Promise.reject();try{var pr=tr.sender.getParameters();if(pr.encodings&&pr.encodings[0]){pr.encodings[0].maxBitrate=64000;tr.sender.setParameters(pr).catch(function(){})}}catch(e){}return tr.sender.replaceTrack(track||null)};
function tick(){var t=now();Object.keys(lines).forEach(function(n){var l=lines[n];if(l.open||!l.t0)return;
 if(!l.stuck&&t-l.t0>15000&&l.main){l.stuck=true;o.onStuck&&o.onStuck(n)}
 if(t>=l.next){var d=[1,1,2,3,5,8,13,20,30][Math.min(l.hello,8)];if(!l.main&&l.hello>8)d=60;l.next=t+d*1000;l.hello++;hello(l,0)}
 if(!(l.conn&&l.conn.open))tryA(l);
 // backup route: forced relay line if nothing within 4 s
 if(l.gen&&!l.relayTried&&l.offerAt&&t-l.offerAt>4000&&o.me<n&&!Object.keys(l.pcs).some(function(g){var x=l.pcs[g].iceConnectionState;return x=='connected'||x=='completed'})){l.relayTried=true;status(l,'Using backup route\u2026');offer(l,true)}
})}
// ---- signalling ----
function sig(l,m){lg('tx '+m.t+(m.g?' g'+m.g:'')+(l.conn&&l.conn.open?' A':' N'));m.f=o.me;m.s=sid;if(l.conn&&l.conn.open){try{l.conn.send(m)}catch(e){}}
 if(!(l.conn&&l.conn.open)||m.t=='hello'){fetch('https://ntfy.sh/'+topic(l.name),{method:'POST',body:JSON.stringify(m)}).catch(function(){})}}
function hello(l,r){sig(l,{t:'hello',p:pid,r:r?1:0})}
function listen(){try{if(es)es.close()}catch(e){}es=new EventSource('https://ntfy.sh/'+topic(o.me)+'/sse');
 es.onmessage=function(e){try{var m=JSON.parse(JSON.parse(e.data).message);if(m&&m.f&&m.s!=sid)handle(m)}catch(x){}};
 es.onerror=function(){if(es.readyState==2)setTimeout(listen,1000)}}
function handle(m,via){lg('rx '+m.t+(m.g?' g'+m.g:''));var n=m.f;if(n==o.me&&m.s==sid)return;var l=line(n);
 if(m.t=='hello'){if(m.p)l.rpid=m.p;o.onSeen&&o.onSeen(n);
  if(l.open&&l.rsid==m.s){if(!m.r)hello(l,1);return}
  if(l.open&&l.rsid!=m.s)closeAll(l);
  if(!l.t0){l.t0=now();l.next=now()+60000;status(l,'Finding '+n+'\u2026')}
  if(l.rsid!=m.s){l.rsid=m.s;l.gen=0}
  if(o.me<n){if(!l.gen||l.lastOfferTo!=m.s||now()-l.offerAt>3000)offer(l,false)}else if(!m.r&&!(l.gen&&now()-(l.repAt||0)<2000)){l.repAt=now();hello(l,1)}
  if(!(l.conn&&l.conn.open)){l.aIdx=0;tryA(l)}return}
 if(m.to&&m.to!=sid)return;
 if(m.t=='offer')onOffer(l,m);else if(m.t=='answer')onAnswer(l,m);else if(m.t=='cand')onCand(l,m);
 else o.onMsg&&o.onMsg(n,m)}
function mkpc(l,g,relay){var cfg={iceServers:ICE.iceServers};if(relay||/[?&]relay=1/.test(location.search))cfg.iceTransportPolicy='relay';
 var pc=new RTCPeerConnection(cfg);l.pcs[g]=pc;pc.relay=relay;pc.g=g;
 var dc=pc.createDataChannel('cb',{negotiated:true,id:0});pc.dc=dc;
 dc.onopen=function(){if(l.open&&l.pc!==pc){return}won(l,pc)};
 dc.onmessage=function(e){try{var m=JSON.parse(e.data);m.f=l.name;if(m.t=='offer'||m.t=='answer'||m.t=='cand')handle(m);else o.onMsg&&o.onMsg(l.name,m)}catch(x){}};
 dc.onclose=function(){if(l.pc===pc)lost(l)};
 pc.ontrack=function(e){if(l.pc===pc||!l.pc){l.remote=new MediaStream([e.track]);pc.remote=l.remote;if(l.pc===pc)o.onTrack&&o.onTrack(l.name,l.remote)}};
 pc.cq=[];pc.onicecandidate=function(e){if(!e.candidate)return;pc.cq.push(e.candidate.toJSON());flushC(l,pc)};
 pc.oniceconnectionstatechange=function(){var s=pc.iceConnectionState;lg('ice g'+g+' '+s);
  if(s=='disconnected'&&l.pc===pc){clearTimeout(pc.rt);pc.rt=setTimeout(function(){if(pc.iceConnectionState!='connected'&&pc.iceConnectionState!='completed'&&o.me<l.name)restart(l,pc)},2500)}
  if(s=='failed'){if(l.pc===pc){if(o.me<l.name)restart(l,pc);setTimeout(function(){if(pc.iceConnectionState=='failed')lost(l)},5000)}}};
 return pc}
function flushC(l,pc){if(!pc.sentDesc||pc.cf||!pc.cq.length)return;pc.cf=setTimeout(function(){pc.cf=0;var c=pc.cq;pc.cq=[];if(c.length)sig(l,{t:'cand',to:l.rsid,g:pc.g,c:c})},120)}
function gathered(pc,ms){return new Promise(function(r){if(pc.iceGatheringState=='complete')return r();var t=setTimeout(r,ms);pc.addEventListener('icegatheringstatechange',function(){if(pc.iceGatheringState=='complete'){clearTimeout(t);r()}})})}
function offer(l,relay){var g=++l.gen,pc=mkpc(l,g,relay);pc.addTransceiver('audio',{direction:'sendrecv'});
 if(o.stream&&o.stream())setTrackPc(pc,null);
 l.offerAt=now();l.lastOfferTo=l.rsid;
 pc.createOffer().then(function(d){return pc.setLocalDescription(d)}).then(function(){return gathered(pc,250)}).then(function(){pc.sentDesc=true;pc.cq=[];setTimeout(function(){flushC(l,pc)},0);sig(l,{t:'offer',to:l.rsid,g:g,relay:relay?1:0,sdp:pc.localDescription.sdp})}).catch(function(){})}
function restart(l,pc){if(pc.restarting)return;pc.restarting=true;status(l,'Using backup route\u2026');
 pc.createOffer({iceRestart:true}).then(function(d){return pc.setLocalDescription(d)}).then(function(){return gathered(pc,250)}).then(function(){sig(l,{t:'offer',to:l.rsid,g:pc.g,relay:pc.relay?1:0,sdp:pc.localDescription.sdp});pc.restarting=false}).catch(function(){pc.restarting=false})}
function onOffer(l,m){l.rsid=m.s;var pc=l.pcs[m.g];if(!pc){pc=mkpc(l,m.g,!!m.relay);if(m.g>l.gen)l.gen=m.g;if(!l.t0)l.t0=now()}
 if(m.relay)status(l,'Using backup route\u2026');
 pc.setRemoteDescription({type:'offer',sdp:opus(m.sdp)}).then(function(){pc.getTransceivers().forEach(function(t){if(t.receiver.track&&t.receiver.track.kind=='audio')t.direction='sendrecv'});(pc.pend||[]).forEach(function(c){pc.addIceCandidate(c).catch(function(){})});pc.pend=[];return pc.createAnswer()})
 .then(function(d){return pc.setLocalDescription(d)}).then(function(){return gathered(pc,150)}).then(function(){pc.sentDesc=true;pc.cq=[];sig(l,{t:'answer',to:m.s,g:m.g,sdp:pc.localDescription.sdp})}).catch(function(){})}
function onAnswer(l,m){var pc=l.pcs[m.g];if(!pc||pc.signalingState!='have-local-offer')return;pc.setRemoteDescription({type:'answer',sdp:opus(m.sdp)}).then(function(){(pc.pend||[]).forEach(function(c){pc.addIceCandidate(c).catch(function(){})});pc.pend=[]}).catch(function(){})}
function onCand(l,m){var pc=l.pcs[m.g];if(!pc)return;var cs=[].concat(m.c);if(!pc.remoteDescription){pc.pend=(pc.pend||[]).concat(cs);return}cs.forEach(function(c){pc.addIceCandidate(c).catch(function(){})})}
function opus(sd){return sd.replace(/a=fmtp:(\d+) (.*useinbandfec=1[^\r\n]*)/g,function(m,pt,f){return /maxaveragebitrate/.test(f)?m:'a=fmtp:'+pt+' '+f+';maxaveragebitrate=64000;stereo=0;sprop-stereo=0;usedtx=0'})}
function setTrackPc(pc){var t=o.stream();if(t)pc.getTransceivers()[0].sender.replaceTrack(t)}
function won(l,pc){lg('won g'+pc.g+(pc.relay?' relay':''));l.pc=pc;l.dc=pc.dc;l.open=true;l.stuck=false;l.hello=0;var ms=now()-(l.t0||now());
 Object.keys(l.pcs).forEach(function(g){if(l.pcs[g]!==pc){try{l.pcs[g].close()}catch(e){}delete l.pcs[g]}});
 if(pc.remote){l.remote=pc.remote;o.onTrack&&o.onTrack(l.name,l.remote)}
 l.via=pc.relay?'relay':'direct';
 pc.getStats().then(function(r){r.forEach(function(s){if(s.type=='candidate-pair'&&s.state=='succeeded'&&s.nominated){var lc=r.get(s.localCandidateId);if(lc&&lc.candidateType=='relay')l.via='relay'}})}).catch(function(){});
 L.last={name:l.name,ms:ms};status(l,'Connected to '+l.name,true);o.onOpen&&o.onOpen(l.name,ms);l.t0=0}
function lost(l){if(!l.open&&!l.pc)return;closeAll(l);o.onClose&&o.onClose(l.name);l.t0=now();l.next=now()+300;l.hello=0;l.stuck=false;status(l,'Finding '+l.name+'\u2026')}
function closeAll(l){l.open=false;Object.keys(l.pcs).forEach(function(g){try{l.pcs[g].close()}catch(e){}});l.pcs={};l.pc=null;l.dc=null;l.gen=0;l.relayTried=false;l.offerAt=0}
// ---- PeerJS path (signalling over peerjs.com, in parallel) ----
function startPeer(k){if(!window.Peer){setTimeout(function(){startPeer(k)},100);return}try{if(peer)peer.destroy()}catch(e){}
 pk=k;var id=o.prefix+o.me+(k?'-'+k:'');pid=null;var p=peer=new Peer(id,{config:ICE,debug:0});
 p.on('open',function(i){lg('peer open '+i);if(p!==peer)return;pid=i;Object.keys(lines).forEach(function(n){var l=lines[n];if(l.t0||l.open){hello(l,0);tryA(l)}})});
 p.on('connection',function(c){c.on('open',function(){var n=(c.metadata&&c.metadata.f)||base(c.peer);attach(line(n),c)})});
 p.on('disconnected',function(){if(p===peer)setTimeout(function(){if(p===peer&&!p.destroyed)try{p.reconnect()}catch(e){startPeer(pk)}},1000)});
 p.on('error',function(e){if(p!==peer)return;
  if(e.type=='unavailable-id'){startPeer((k+1)%4)}
  else if(e.type=='peer-unavailable'){var mm=String(e.message||'').match(/peer\s+(\S+)/i);var n=mm?base(mm[1]):null;if(n&&lines[n]){var l=lines[n];if(l.rpid&&mm[1]==l.rpid)l.rpid=null;else l.aIdx=(l.aIdx+1)%4;l.aAt=0}}
  else if(e.type=='network'||e.type=='server-error'||e.type=='socket-error'||e.type=='socket-closed'){setTimeout(function(){if(p===peer)startPeer(pk)},1000)}})}
// take back the plain id after a while if we had to use an alternate
setInterval(function(){if(pk&&!Object.keys(lines).some(function(n){return lines[n].calling}))startPeer(0)},60000);
function tryA(l){if(!peer||!pid||peer.disconnected)return;if(l.conn&&l.conn.open)return;if(l.aAt&&now()-l.aAt<1500)return;l.aAt=now();
 var id=l.rpid||o.prefix+l.name+(l.aIdx?'-'+l.aIdx:'');if(id==pid)return;
 attach(l,peer.connect(id,{serialization:'json',reliable:true,metadata:{f:o.me}}))}
function attach(l,c){c.on('open',function(){if(l.conn&&l.conn!==c&&l.conn.open){return}l.conn=c;if(!l.open)hello(l,0)});
 if(c.open){l.conn=c;if(!l.open)hello(l,0)}
 c.on('data',function(m){if(m&&typeof m=='object'){m.f=l.name;handle(m)}});
 c.on('close',function(){if(l.conn===c)l.conn=null});c.on('error',function(){})}
document.addEventListener('visibilitychange',function(){if(!document.hidden){if(!peer||peer.destroyed)startPeer(pk);else if(peer.disconnected)try{peer.reconnect()}catch(e){};if(!es||es.readyState==2)listen();Object.keys(lines).forEach(function(n){var l=lines[n];if(!l.open&&l.t0){l.next=0}})}});
window.addEventListener('online',function(){listen();Object.keys(lines).forEach(function(n){var l=lines[n];if(l.pc&&o.me<n)restart(l,l.pc);else if(!l.open)l.next=0})});
})();
