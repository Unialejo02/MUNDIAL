"use strict";
/* ---------- almacenamiento (funciona offline; degrada en sandbox) ---------- */
const Store={mem:{},get(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return this.mem[k]??null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){this.mem[k]=v}}};
const KEY='oraculo2026_v3';
const STATE_VERSION = 3;
const DATA_UPDATED_AT = '23 jun 2026';
const RESULTS_UPDATED_AT = '22 jun 2026';

/* ---------- datos: 48 selecciones (Elo base 23 jun 2026) ---------- */
/* code, nombre, bandera, grupo, posición en grupo (0-3), elo base */
const TEAMS=[
 ["MEX","México","🇲🇽","A",0,1722],["RSA","Sudáfrica","🇿🇦","A",1,1445],["KOR","Corea del Sur","🇰🇷","A",2,1592],["CZE","Chequia","🇨🇿","A",3,1481],
 ["CAN","Canadá","🇨🇦","B",0,1572],["BIH","Bosnia","🇧🇦","B",1,1470],["QAT","Catar","🇶🇦","B",2,1450],["SUI","Suiza","🇨🇭","B",3,1655],
 ["BRA","Brasil","🇧🇷","C",0,1772],["MAR","Marruecos","🇲🇦","C",1,1770],["HAI","Haití","🇭🇹","C",2,1320],["SCO","Escocia","🏴","C",3,1504],
 ["USA","Estados Unidos","🇺🇸","D",0,1710],["PAR","Paraguay","🇵🇾","D",1,1517],["AUS","Australia","🇦🇺","D",2,1585],["TUR","Turquía","🇹🇷","D",3,1550],
 ["GER","Alemania","🇩🇪","E",0,1760],["CUW","Curazao","🇨🇼","E",1,1380],["CIV","Costa de Marfil","🇨🇮","E",2,1552],["ECU","Ecuador","🇪🇨","E",3,1558],
 ["NED","Países Bajos","🇳🇱","F",0,1764],["JPN","Japón","🇯🇵","F",1,1681],["SWE","Suecia","🇸🇪","F",2,1518],["TUN","Túnez","🇹🇳","F",3,1480],
 ["BEL","Bélgica","🇧🇪","G",0,1728],["EGY","Egipto","🇪🇬","G",1,1583],["IRN","Irán","🇮🇷","G",2,1611],["NZL","Nueva Zelanda","🇳🇿","G",3,1277],
 ["ESP","España","🇪🇸","H",0,1864],["CPV","Cabo Verde","🇨🇻","H",1,1400],["KSA","Arabia Saudí","🇸🇦","H",2,1430],["URU","Uruguay","🇺🇾","H",3,1650],
 ["FRA","Francia","🇫🇷","I",0,1894],["SEN","Senegal","🇸🇳","I",1,1638],["IRQ","Irak","🇮🇶","I",2,1390],["NOR","Noruega","🇳🇴","I",3,1606],
 ["ARG","Argentina","🇦🇷","J",0,1902],["ALG","Argelia","🇩🇿","J",1,1559],["AUT","Austria","🇦🇹","J",2,1600],["JOR","Jordania","🇯🇴","J",3,1390],
 ["POR","Portugal","🇵🇹","K",0,1755],["COD","RD Congo","🇨🇩","K",1,1487],["UZB","Uzbekistán","🇺🇿","K",2,1437],["COL","Colombia","🇨🇴","K",3,1713],
 ["ENG","Inglaterra","🏴","L",0,1848],["CRO","Croacia","🇭🇷","L",1,1695],["GHA","Ghana","🇬🇭","L",2,1405],["PAN","Panamá","🇵🇦","L",3,1505]
];
const GROUPS="ABCDEFGHIJKL".split("");
const TEAMS_BY_CODE={}; TEAMS.forEach(t=>TEAMS_BY_CODE[t[0]]={code:t[0],name:t[1],flag:t[2],group:t[3],pos:t[4],base:t[5],source:t[5] >= 1450 ? 'verified' : 'estimated'});
function groupTeams(g){return TEAMS.filter(t=>t[3]===g).sort((a,b)=>a[4]-b[4]).map(t=>t[0])}

/* ---------- fixtures: patrón FIFA por grupo [1,2,3,4] ---------- */
/* J1: 0-1, 2-3 | J2: 0-2, 3-1 | J3: 3-0, 1-2  (índices de posición) */
const MD_PATTERN=[ [[0,1],[2,3]], [[0,2],[3,1]], [[3,0],[1,2]] ];
const DATES={ // fechas conocidas (jornada por grupo): clave grupo+md
  default:["11–17 jun","17–22 jun","23–27 jun"]
};
const SPECIAL_DATE={"K-2-0":"23 jun","K-2-1":"24 jun","K-3-0":"27 jun"};
const FIXTURES=[];
GROUPS.forEach(g=>{
  const ts=groupTeams(g);
  MD_PATTERN.forEach((pair,md)=>{
    pair.forEach((p,i)=>{
      const id=`${g}-${md+1}-${i}`;
      FIXTURES.push({id,group:g,md:md+1,home:ts[p[0]],away:ts[p[1]]});
    });
  });
});

/* resultados verificados precargados [home,away] */
const SEED={
 "A-2-0":[1,0],"A-2-1":[1,1],
 "E-2-0":[2,1],"E-2-1":[1,1],
 "F-1-0":[2,2],"F-2-0":[5,1],
 "G-2-1":[1,3],
 "H-2-1":[2,2],
 "I-1-0":[3,1],"I-1-1":[1,4],
 "J-1-0":[3,0],
 "K-1-0":[1,1],
 "L-1-0":[4,2]
};

/* ---------- estado ---------- */
let STATE=Store.get(KEY)||{results:{},eloOverride:{},liveData:{},apiConfig:{provider:'api-football',apiKey:'',season:2026}};
if(!STATE.results||Object.keys(STATE.results).length===0){STATE.results=JSON.parse(JSON.stringify(SEED));}
if(!STATE.liveData) STATE.liveData={};
if(!STATE.apiConfig) STATE.apiConfig={provider:'api-football',apiKey:'',season:2026};
function save(){Store.set(KEY,STATE)}

/* ---------- Elo actual: base + réplica de todos los resultados ---------- */
let ELO={};
function recomputeElo(){
  ELO={}; TEAMS.forEach(t=>ELO[t[0]]= (STATE.eloOverride[t[0]]!=null?STATE.eloOverride[t[0]]:t[5]));
  // replay en orden jornada->grupo para determinismo
  const ids=Object.keys(STATE.results).sort();
  ids.forEach(id=>{
    const fx=FIXTURES.find(f=>f.id===id); if(!fx)return;
    const r=STATE.results[id]; if(!r)return;
    const [gh,ga]=r; const Ra=ELO[fx.home],Rb=ELO[fx.away];
    const We=1/(Math.pow(10,(Rb-Ra)/400)+1);
    let W = gh>ga?1:(gh<ga?0:0.5);
    const gd=Math.abs(gh-ga); let G=1; if(gd===2)G=1.5; else if(gd>=3)G=(11+gd)/8;
    const K=50;
    const delta=K*G*(W-We);
    ELO[fx.home]=Ra+delta; ELO[fx.away]=Rb-delta;
  });
}
function elo(code){return ELO[code]}

/* ---------- motor Poisson ---------- */
function poissonPMF(lambda,k){let p=Math.exp(-lambda);for(let i=1;i<=k;i++)p*=lambda/i;return p}
function pGE(mean,k){let c=0;for(let n=0;n<k;n++)c+=poissonPMF(mean,n);return Math.max(0,1-c)} // P(X>=k)
function normalizeGridProbabilities(pa,pb){
  return pa.reduce((a,b)=>a+b,0)*pb.reduce((a,b)=>a+b,0);
}
function expectedGoalsFromElo(ra,rb){
  const dr=ra-rb;
  const G0=1.32, beta=0.85;
  const ex=beta*dr/400;
  return {
    lambdaA:Math.max(0.20,Math.min(5,G0*Math.exp(ex))),
    lambdaB:Math.max(0.20,Math.min(5,G0*Math.exp(-ex)))
  };
}
function calculateGoalMarkets(lambdaA,lambdaB){
  const N=10;
  const pa=[],pb=[];
  for(let i=0;i<N;i++){pa.push(poissonPMF(lambdaA,i));pb.push(poissonPMF(lambdaB,i));}
  const mass=normalizeGridProbabilities(pa,pb);
  let pH=0,pD=0,pA=0,o15=0,o25=0,o35=0,btts=0,hA15=0,best={p:-1,i:0,j:0};
  const exact=[];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    const prob=pa[i]*pb[j];
    if(i>j)pH+=prob; else if(i===j)pD+=prob; else pA+=prob;
    if(i+j>=2)o15+=prob;
    if(i+j>=3)o25+=prob;
    if(i+j>=4)o35+=prob;
    if(i>=1&&j>=1)btts+=prob;
    if(i-j>=2)hA15+=prob;
    if(prob>best.p)best={p:prob,i,j};
    exact.push({i,j,p:prob});
  }
  const nm=x=>x/mass;
  exact.forEach(e=>e.p=nm(e.p)); exact.sort((x,y)=>y.p-x.p);
  const spa=pa.reduce((a,b)=>a+b,0), spb=pb.reduce((a,b)=>a+b,0);
  return {
    pH:nm(pH),pD:nm(pD),pA:nm(pA),o15:nm(o15),o25:nm(o25),o35:nm(o35),
    btts:nm(btts),hA15:nm(hA15),best,exact:exact.slice(0,5),over:nm(o25),
    aScore:1-pa[0]/spa,bScore:1-pb[0]/spb,csA:pb[0]/spb,csB:pa[0]/spa
  };
}
function calculateCorners(lambdaA,lambdaB){
  const total=8.5+0.6*Math.abs(lambdaA-lambdaB);
  const sA=Math.pow(lambdaA,0.85),sB=Math.pow(lambdaB,0.85);
  const a=total*sA/(sA+sB),b=total-a;
  return {tot:total,a,b,o75:pGE(total,8),o85:pGE(total,9),o95:pGE(total,10),o105:pGE(total,11)};
}
function calculateCards(winExpectation){
  const even=1-2*Math.abs(winExpectation-0.5);
  const total=3.2+2.0*even, tilt=0.10*(2*winExpectation-1);
  const redMean=0.14+0.14*even;
  return {tot:total,a:total*(0.5-tilt),b:total*(0.5+tilt),o35:pGE(total,4),o45:pGE(total,5),o55:pGE(total,6),red:1-Math.exp(-redMean)};
}
function predict(aCode,bCode,homeAdv){
  let Ra=elo(aCode), Rb=elo(bCode);
  if(homeAdv)Ra+=60;
  const dr=Ra-Rb;
  const We=1/(Math.pow(10,-dr/400)+1);
  const {lambdaA,lambdaB}=expectedGoalsFromElo(Ra,Rb);
  const goals=calculateGoalMarkets(lambdaA,lambdaB);
  return {Ra,Rb,lamA:lambdaA,lamB:lambdaB,We,...goals,
    corners:calculateCorners(lambdaA,lambdaB),
    cards:calculateCards(We)};
}
const pct=x=>Math.round(x*100);


function probabilityLabel(p){
  const max=Math.max(p.pH,p.pD,p.pA);
  if(max>=0.58) return 'alta';
  if(max>=0.46) return 'media';
  return 'baja';
}
function likelyOutcomeText(p,A,B){
  const outcomes=[{label:`victoria de ${A.name}`,prob:p.pH},{label:'empate',prob:p.pD},{label:`victoria de ${B.name}`,prob:p.pA}].sort((x,y)=>y.prob-x.prob);
  return outcomes[0];
}
function matchDataHTML(p,A,B,fixtureId){
  const live=fixtureId && STATE.liveData ? STATE.liveData[fixtureId] : null;
  const status=live?.status ? live.status : 'Sin datos en vivo';
  const minute=live?.minute ? ` · ${live.minute}'` : '';
  const shots=live?.shotsOnTarget ? `${live.shotsOnTarget.home ?? '—'}–${live.shotsOnTarget.away ?? '—'}` : '—';
  const possession=live?.possession ? `${live.possession.home ?? '—'}%–${live.possession.away ?? '—'}%` : '—';
  const corners=live?.corners ? `${live.corners.home ?? '—'}–${live.corners.away ?? '—'}` : `${p.corners.a.toFixed(1)}–${p.corners.b.toFixed(1)} esp.`;
  const cards=live?.cards ? `${live.cards.home ?? '—'}–${live.cards.away ?? '—'}` : `${p.cards.a.toFixed(1)}–${p.cards.b.toFixed(1)} esp.`;
  return `<div class="match-data">
    <span class="eyebrow">Datos que alimentan la lectura</span>
    <div class="data-grid">
      <div class="data-pill"><span>Estado</span><b>${status}${minute}</b></div>
      <div class="data-pill"><span>Elo</span><b>${Math.round(p.Ra)}–${Math.round(p.Rb)}</b></div>
      <div class="data-pill"><span>xG estimado</span><b>${p.lamA.toFixed(1)}–${p.lamB.toFixed(1)}</b></div>
      <div class="data-pill"><span>Tiros al arco</span><b>${shots}</b></div>
      <div class="data-pill"><span>Posesión</span><b>${possession}</b></div>
      <div class="data-pill"><span>Córners</span><b>${corners}</b></div>
      <div class="data-pill"><span>Tarjetas</span><b>${cards}</b></div>
      <div class="data-pill"><span>Confianza</span><b>${probabilityLabel(p)}</b></div>
    </div>
    <p class="disclaim" style="margin-top:8px">Cuando conectes una API, esta sección recibe marcador, estado, minuto y estadísticas reales del partido. Con esos datos el Oráculo refresca tablas, Elo y predicciones.</p>
  </div>`;
}
function finalAdviceHTML(p,A,B){
  const outcome=likelyOutcomeText(p,A,B);
  const diff=Math.abs(p.pH-p.pA);
  let risk='alto';
  if(Math.max(p.pH,p.pD,p.pA)>=0.55) risk='medio';
  if(Math.max(p.pH,p.pD,p.pA)>=0.64) risk='bajo';
  let suggestion='Partido parejo: mejor esperar alineaciones confirmadas y datos en vivo antes de tomar una lectura fuerte.';
  if(outcome.prob>=0.55){
    suggestion=`El modelo inclina el partido hacia ${outcome.label}. La lectura es más sólida si las estadísticas en vivo confirman dominio en tiros al arco, posesión útil y córners.`;
  }else if(p.btts>=0.56){
    suggestion='La señal más clara no está en el ganador sino en goles: ambos equipos tienen buena probabilidad de marcar.';
  }else if(p.o25>=0.56){
    suggestion='La tendencia favorece un partido con varios goles, pero revisa alineaciones y ritmo antes de confiarte.';
  }else if(diff<0.08){
    suggestion='La diferencia entre equipos es pequeña; el empate y los mercados conservadores tienen más sentido que forzar ganador.';
  }
  return `<div class="oracle-note">
    <span class="eyebrow">Nota final del Oráculo</span>
    <h3>${A.name} vs ${B.name}: posible predicción ${p.best.i}–${p.best.j}</h3>
    <p><b>Lectura:</b> ${outcome.label} con ${pct(outcome.prob)}% de probabilidad. Riesgo estimado: <b>${risk}</b>.</p>
    <p><b>Sugerencia:</b> ${suggestion}</p>
    <p class="disclaim">Esta nota resume el modelo Poisson + Elo y los datos disponibles. No garantiza resultados; úsala como apoyo de análisis, no como certeza.</p>
  </div>`;
}

/* ---------- render: tarjeta de predicción ---------- */
function predCardHTML(aCode,bCode,homeAdv,opts){
  opts=opts||{};
  const A=TEAMS_BY_CODE[aCode],B=TEAMS_BY_CODE[bCode],p=predict(aCode,bCode,homeAdv);
  const hW=pct(p.pH),dW=pct(p.pD),aW=pct(p.pA);
  const chips=p.exact.map(e=>`<span class="chip"><b>${e.i}–${e.j}</b> ${pct(e.p)}%</span>`).join("");
  const oid=opts.oddPrefix||'op';
  const fixtureId=opts.fixtureId||null;
  return `
  <div class="board">
    <div class="board-top">
      <div class="tname"><span class="tflag">${A.flag}</span><b>${A.name}</b><span class="elo">Elo ${Math.round(p.Ra)}${homeAdv?' +local':''}</span></div>
      <div style="text-align:center">
        <div class="scoreline"><span class="n">${p.best.i}</span><span class="x">–</span><span class="n">${p.best.j}</span></div>
        <div class="score-cap">Marcador más probable</div>
      </div>
      <div class="tname"><span class="tflag">${B.flag}</span><b>${B.name}</b><span class="elo">Elo ${Math.round(p.Rb)}</span></div>
    </div>

    <div class="probbar">
      <div class="seg-h" style="flex:${Math.max(hW,1)}">${hW>7?hW+'%':''}</div>
      <div class="seg-d" style="flex:${Math.max(dW,1)}">${dW>7?dW+'%':''}</div>
      <div class="seg-a" style="flex:${Math.max(aW,1)}">${aW>7?aW+'%':''}</div>
    </div>
    <div class="problabels"><span>Gana ${A.name} · ${hW}%</span><span>Empate · ${dW}%</span><span>Gana ${B.name} · ${aW}%</span></div>

    <div class="mkt">
      <div class="mcell"><div class="k">Goles esperados</div><div class="v">${p.lamA.toFixed(1)} – ${p.lamB.toFixed(1)}</div></div>
      <div class="mcell"><div class="k">Más de 2.5</div><div class="v">${pct(p.over)}%</div></div>
      <div class="mcell"><div class="k">Ambos marcan</div><div class="v">${pct(p.btts)}%</div></div>
    </div>
    <div class="chips"><span style="font-family:var(--mono);font-size:10px;color:var(--mut);align-self:center;text-transform:uppercase;letter-spacing:.1em">Marcadores probables:</span>${chips}</div>

    ${marketsHTML(p,A,B)}

    ${matchDataHTML(p,A,B,fixtureId)}

    ${finalAdviceHTML(p,A,B)}

    <div class="value-wrap">
      <span class="eyebrow">Valor de apuesta — ingresa las cuotas de tu casa</span>
      <div class="odds3">
        <div class="o"><label class="fl">Cuota 1 (${A.code})</label><input type="number" step="0.01" min="1" id="${oid}H" placeholder="ej. 2.40"></div>
        <div class="o"><label class="fl">Cuota X</label><input type="number" step="0.01" min="1" id="${oid}D" placeholder="ej. 3.20"></div>
        <div class="o"><label class="fl">Cuota 2 (${B.code})</label><input type="number" step="0.01" min="1" id="${oid}A" placeholder="ej. 2.90"></div>
      </div>
      <div class="valgrid" id="${oid}OUT">
        ${valBox('Local',p.pH)}${valBox('Empate',p.pD)}${valBox('Visita',p.pA)}
      </div>
      <p class="disclaim" style="margin-top:10px">Cuota justa = 1 ÷ probabilidad. Si la cuota de tu casa supera la justa, hay <span style="color:var(--verde)">valor</span>. Herramienta informativa, no garantiza resultados.</p>
    </div>
  </div>`;
}
function mRow(label,pick,prob){
  if(prob==null) return `<tr><td class="mk">${label}</td><td class="pk">${pick}</td><td class="pr">—</td><td class="fo">—</td></tr>`;
  const w=Math.max(4,Math.round(prob*54));
  return `<tr><td class="mk">${label}</td><td class="pk">${pick}</td>`+
    `<td class="pr"><span class="mbar" style="width:${w}px"></span>${pct(prob)}%</td>`+
    `<td class="fo">${(1/prob).toFixed(2)}</td></tr>`;
}
function mGroup(title,rows){return `<div class="mgroup"><h4>${title}</h4><table class="mtbl">${rows.join("")}</table></div>`}
function marketsHTML(p,A,B){
  const resultado=mGroup('Resultado · 1X2 · hándicap',[
    mRow('Gana '+A.name,'1',p.pH),mRow('Empate','X',p.pD),mRow('Gana '+B.name,'2',p.pA),
    mRow('Doble — 1X','local o empate',p.pH+p.pD),
    mRow('Doble — X2','empate o visita',p.pD+p.pA),
    mRow('Doble — 12','sin empate',p.pH+p.pA),
    mRow(A.name+' −1.5','gana por 2+',p.hA15),
    mRow(B.name+' +1.5','no pierde por 2+',1-p.hA15)
  ]);
  const goles=mGroup('Goles',[
    mRow('Más de 1.5','+1.5',p.o15),mRow('Menos de 1.5','−1.5',1-p.o15),
    mRow('Más de 2.5','+2.5',p.o25),mRow('Menos de 2.5','−2.5',1-p.o25),
    mRow('Más de 3.5','+3.5',p.o35),mRow('Menos de 3.5','−3.5',1-p.o35),
    mRow('Ambos marcan — Sí','BTTS',p.btts),mRow('Ambos marcan — No','',1-p.btts),
    mRow('Marca '+A.name,'',p.aScore),mRow('Marca '+B.name,'',p.bScore),
    mRow('Cero del '+A.name,'visita no marca',p.csA),
    mRow('Cero del '+B.name,'local no marca',p.csB)
  ]);
  const corn=mGroup('Córners · ~'+p.corners.tot.toFixed(1)+' esperados',[
    mRow(A.name,p.corners.a.toFixed(1)+' córners',null),
    mRow(B.name,p.corners.b.toFixed(1)+' córners',null),
    mRow('Más de 7.5','+7.5',p.corners.o75),
    mRow('Más de 8.5','+8.5',p.corners.o85),
    mRow('Más de 9.5','+9.5',p.corners.o95),
    mRow('Más de 10.5','+10.5',p.corners.o105)
  ]);
  const tarj=mGroup('Tarjetas amarillas · ~'+p.cards.tot.toFixed(1)+' esperadas',[
    mRow(A.name,p.cards.a.toFixed(1)+' tarjetas',null),
    mRow(B.name,p.cards.b.toFixed(1)+' tarjetas',null),
    mRow('Más de 3.5','+3.5',p.cards.o35),
    mRow('Más de 4.5','+4.5',p.cards.o45),
    mRow('Más de 5.5','+5.5',p.cards.o55),
    mRow('Al menos una roja','',p.cards.red)
  ]);
  return `<div class="markets">
    <span class="eyebrow">Mercados — pronóstico y cuota justa (1 ÷ probabilidad)</span>
    <div class="grid2">${resultado}${goles}</div>
    <div class="grid2">${corn}${tarj}</div>
    <p class="disclaim" style="margin-top:8px">Goles y resultado salen del modelo Poisson+Elo. Córners y tarjetas usan promedios reales del torneo ajustados por el cruce y son <b>más ruidosos</b>: tómalos como orientación. Si la cuota de tu casa supera la cuota justa, hay valor.</p>
  </div>`;
}
function valBox(lab,prob,odd){
  const fair=(1/prob);
  let badge=`<div class="vbadge" style="background:var(--panel);color:var(--mut);border:1px solid var(--line)">Cuota justa ${fair.toFixed(2)}</div>`;
  if(odd&&odd>1){
    const ev=prob*odd-1;
    badge = ev>0
      ? `<div class="vbadge vpos">VALOR +${(ev*100).toFixed(0)}%</div>`
      : `<div class="vbadge vneg">${(ev*100).toFixed(0)}%</div>`;
  }
  return `<div class="vbox"><div class="lab">${lab}</div><div class="fair">${pct(prob)}%</div>${badge}</div>`;
}
function wireOdds(prefix,aCode,bCode,homeAdv){
  const p=predict(aCode,bCode,homeAdv);
  const probs={H:p.pH,D:p.pD,A:p.pA}; const labs={H:'Local',D:'Empate',A:'Visita'};
  function upd(){
    const out=document.getElementById(prefix+'OUT'); if(!out)return;
    out.innerHTML=['H','D','A'].map(k=>{
      const v=parseFloat(document.getElementById(prefix+k).value);
      return valBox(labs[k],probs[k],isNaN(v)?null:v);
    }).join("");
  }
  ['H','D','A'].forEach(k=>{const el=document.getElementById(prefix+k);if(el)el.addEventListener('input',upd);});
}

/* ---------- TAB: Predicciones ---------- */
function fillSelect(sel,val){
  sel.innerHTML=GROUPS.map(g=>`<optgroup label="Grupo ${g}">`+
    groupTeams(g).map(c=>`<option value="${c}" ${c===val?'selected':''}>${TEAMS_BY_CODE[c].flag} ${TEAMS_BY_CODE[c].name}</option>`).join("")+
    `</optgroup>`).join("");
}
function renderPred(){
  const a=document.getElementById('selA').value, b=document.getElementById('selB').value;
  const ha=document.getElementById('homeAdv').checked;
  if(a===b){
    document.getElementById('predCard').innerHTML='<div class="note">Selecciona dos equipos diferentes para generar la predicción.</div>';
    return;
  }
  document.getElementById('predCard').innerHTML=predCardHTML(a,b,ha,{oddPrefix:'pp'});
  wireOdds('pp',a,b,ha);
}
function renderColKpi(){
  const k=document.getElementById('colKpi');
  const st=standings('K');
  const col=st.find(r=>r.code==='COL');
  const pPor=predict('COL','POR',false);
  k.innerHTML=`
   <div class="kpi"><div class="n">${col?col.pts:0}</div><div class="l">Puntos Colombia</div></div>
   <div class="kpi"><div class="n">${col?(st.indexOf(col)+1)+'º':'-'}</div><div class="l">Posición Grupo K</div></div>
   <div class="kpi"><div class="n">${pct(pPor.pH)}%</div><div class="l">Gana a Portugal</div></div>
   <div class="kpi"><div class="n">${pPor.best.i}–${pPor.best.j}</div><div class="l">Marcador probable vs POR</div></div>`;
}

/* ---------- TAB: Calendario ---------- */
function renderCal(){
  const filter=document.getElementById('calFilter').value;
  const list=document.getElementById('calList'); list.innerHTML="";
  const groups = filter==='ALL'?GROUPS:[filter];
  groups.forEach(g=>{
    const fxs=FIXTURES.filter(f=>f.group===g);
    let html=`<div class="gtitle"><span class="gl">${g}</span><h3>Grupo ${g}</h3></div>`;
    fxs.forEach(f=>{
      const A=TEAMS_BY_CODE[f.home],B=TEAMS_BY_CODE[f.away],r=STATE.results[f.id];
      const seeded=SEED[f.id]!=null && r && SEED[f.id][0]===r[0] && SEED[f.id][1]===r[1];
      const date=SPECIAL_DATE[f.id]||DATES.default[f.md-1];
      const star=(f.id==='K-3-0');
      let scoreCell, predCell='';
      if(r){scoreCell=`<div class="sc">${r[0]}–${r[1]}</div>`;}
      else{
        const p=predict(f.home,f.away,false);
        scoreCell=`<div class="sc pend">pendiente</div>`;
        predCell=`<div class="pp">pred ${p.best.i}–${p.best.j}<br>${pct(Math.max(p.pH,p.pD,p.pA))}%</div>`;
      }
      html+=`<div class="fxt ${star?'star':''}" data-id="${f.id}">
        <div class="md">J${f.md}<br>${date}</div>
        <div class="side"><span class="fg">${A.flag}</span><span class="nm">${A.name}</span></div>
        ${scoreCell}
        <div class="side away"><span class="nm">${B.name}</span><span class="fg">${B.flag}</span></div>
        ${predCell||`<div class="pp">${seeded?'<span class=tagseed>verif.</span>':''}</div>`}
      </div>`;
    });
    list.insertAdjacentHTML('beforeend',html);
  });
  list.querySelectorAll('.fxt').forEach(el=>el.addEventListener('click',()=>openModal(el.dataset.id)));
}

/* ---------- TAB: Grupos ---------- */
function standings(g){
  const rows=groupTeams(g).map(c=>({code:c,pj:0,g:0,e:0,p:0,gf:0,gc:0,dg:0,pts:0}));
  const idx={}; rows.forEach(r=>idx[r.code]=r);
  FIXTURES.filter(f=>f.group===g).forEach(f=>{
    const r=STATE.results[f.id]; if(!r)return;
    const h=idx[f.home],a=idx[f.away],[gh,ga]=r;
    h.pj++;a.pj++;h.gf+=gh;h.gc+=ga;a.gf+=ga;a.gc+=gh;
    if(gh>ga){h.g++;a.p++;h.pts+=3;} else if(gh<ga){a.g++;h.p++;a.pts+=3;} else {h.e++;a.e++;h.pts++;a.pts++;}
  });
  rows.forEach(r=>r.dg=r.gf-r.gc);
  rows.sort((x,y)=>y.pts-x.pts||y.dg-x.dg||y.gf-x.gf|| (x.code<y.code?-1:1));
  return rows;
}
function renderGrp(){
  const list=document.getElementById('grpList'); list.innerHTML="";
  GROUPS.forEach(g=>{
    const rows=standings(g);
    let h=`<div class="gtbl"><div style="padding:10px 14px;border-bottom:1px solid var(--line)" class="gtitle" >
      <span class="gl">${g}</span><h3>Grupo ${g}</h3></div><table>
      <thead><tr><th style="text-align:left;padding-left:14px">Equipo</th><th>PJ</th><th>DG</th><th>GF</th><th>Pts</th></tr></thead><tbody>`;
    rows.forEach((r,i)=>{
      const cls=i<2?'qual':(i===2?'third':'');
      h+=`<tr class="${cls}"><td class="team"><span class="pos">${i+1}</span>${TEAMS_BY_CODE[r.code].flag} ${TEAMS_BY_CODE[r.code].name}</td>
        <td>${r.pj}</td><td>${r.dg>0?'+':''}${r.dg}</td><td>${r.gf}</td><td class="pts">${r.pts}</td></tr>`;
    });
    h+=`</tbody></table></div>`;
    list.insertAdjacentHTML('beforeend',h);
  });
  renderThirds();
}
function renderThirds(){
  const thirds=GROUPS.map(g=>{const r=standings(g)[2];return {...r,group:g}});
  thirds.sort((x,y)=>y.pts-x.pts||y.dg-x.dg||y.gf-x.gf);
  let h=`<table><thead><tr><th style="text-align:left;padding-left:14px">3º lugar</th><th>Grupo</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead><tbody>`;
  thirds.forEach((r,i)=>{
    const cls=i<8?'qual':'';
    h+=`<tr class="${cls}"><td class="team"><span class="pos">${i+1}</span>${TEAMS_BY_CODE[r.code].flag} ${TEAMS_BY_CODE[r.code].name}</td>
      <td>${r.group}</td><td>${r.pj}</td><td>${r.dg>0?'+':''}${r.dg}</td><td class="pts">${r.pts}</td></tr>`;
  });
  h+=`</tbody></table>`;
  document.getElementById('thirdsTbl').innerHTML=h;
}

/* ---------- TAB: Equipos ---------- */
function renderEq(){
  const list=document.getElementById('eqList'); list.innerHTML="";
  const sorted=[...TEAMS].sort((a,b)=>elo(b[0])-elo(a[0]));
  sorted.forEach(t=>{
    const c=t[0], cur=elo(c), base=(STATE.eloOverride[c]!=null?STATE.eloOverride[c]:t[5]);
    const d=cur-base; const dtxt=Math.abs(d)<0.5?'—':(d>0?'+':'')+Math.round(d);
    const dcol=d>0.5?'var(--verde)':(d<-0.5?'var(--rojo)':'var(--mut)');
    list.insertAdjacentHTML('beforeend',`<div class="teamrow">
      <span class="fg">${t[2]}</span><span class="nm">${t[1]}</span>
      <span class="gpill">Grupo ${t[3]}</span>
      <span class="delta" style="color:${dcol}">${dtxt}</span>
      <input type="number" data-c="${c}" value="${Math.round(base)}">
    </div>`);
  });
  list.querySelectorAll('input').forEach(inp=>inp.addEventListener('change',()=>{
    const v=parseFloat(inp.value); const c=inp.dataset.c;
    if(!isNaN(v)){STATE.eloOverride[c]=v; save(); recomputeElo(); refreshAll(); toast('Elo actualizado');}
  }));
}

/* ---------- modal de marcador ---------- */
let curId=null;
function openModal(id){
  curId=id; const f=FIXTURES.find(x=>x.id===id); const A=TEAMS_BY_CODE[f.home],B=TEAMS_BY_CODE[f.away];
  document.getElementById('modalTitle').textContent=`${A.name} vs ${B.name}`;
  document.getElementById('meFlagA').textContent=A.flag;
  document.getElementById('meFlagB').textContent=B.flag;
  const r=STATE.results[id];
  document.getElementById('meA').value=r?r[0]:0;
  document.getElementById('meB').value=r?r[1]:0;
  const p=predict(f.home,f.away,false);
  document.getElementById('modalBody').innerHTML=`<div style="text-align:center;color:var(--mut);font-size:13px">Jornada ${f.md} · Grupo ${f.group}</div>`;
  document.getElementById('modalPred').innerHTML=`Predicción del modelo: <b>${p.best.i}–${p.best.j}</b> · ${A.name} ${pct(p.pH)}% / X ${pct(p.pD)}% / ${B.name} ${pct(p.pA)}%`;
  document.getElementById('modal').classList.add('show');
}
function closeModal(){document.getElementById('modal').classList.remove('show');curId=null;}

/* ---------- refrescar todo ---------- */
function refreshAll(){
  recomputeElo();
  renderPred(); renderColKpi(); renderCal(); renderGrp(); renderEq();
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1600);}



/* ---------- actualización automática vía API ---------- */
const API_FOOTBALL_FIXTURE_IDS={
  // Ejemplo: "K-3-0": 1234567
  // Debes completar estos IDs con los fixture_id reales que entregue tu proveedor.
};
function saveApiConfig(){
  const key=document.getElementById('apiKeyInput')?.value?.trim() || '';
  const season=parseInt(document.getElementById('apiSeasonInput')?.value,10) || 2026;
  STATE.apiConfig={provider:'api-football',apiKey:key,season};
  save();
  toast('Configuración guardada');
}
function renderApiConfig(){
  const keyEl=document.getElementById('apiKeyInput');
  const seasonEl=document.getElementById('apiSeasonInput');
  if(keyEl) keyEl.value=STATE.apiConfig?.apiKey || '';
  if(seasonEl) seasonEl.value=STATE.apiConfig?.season || 2026;
}
function applyLiveFixture(fixtureId, payload){
  const fx=FIXTURES.find(f=>f.id===fixtureId);
  if(!fx || !payload) return false;
  const goals=payload.goals || {};
  if(Number.isFinite(goals.home) && Number.isFinite(goals.away)){
    STATE.results[fixtureId]=[goals.home,goals.away];
  }
  const stats=(payload.statistics||[]).reduce((acc,item)=>{
    const teamCode=item.team?.code;
    const isHome=teamCode===fx.home || item.team?.name===TEAMS_BY_CODE[fx.home].name;
    const side=isHome?'home':'away';
    (item.statistics||[]).forEach(st=>{
      const type=String(st.type||'').toLowerCase();
      const val=String(st.value ?? '').replace('%','');
      if(type.includes('possession')) acc.possession[side]=Number(val);
      if(type.includes('shots on goal')) acc.shotsOnTarget[side]=Number(val);
      if(type.includes('corner')) acc.corners[side]=Number(val);
      if(type.includes('yellow')) acc.cards[side]=(acc.cards[side]||0)+Number(val);
    });
    return acc;
  },{possession:{},shotsOnTarget:{},corners:{},cards:{}});
  STATE.liveData[fixtureId]={
    status:payload.fixture?.status?.short || payload.fixture?.status?.long || 'Actualizado',
    minute:payload.fixture?.status?.elapsed || null,
    possession:stats.possession,
    shotsOnTarget:stats.shotsOnTarget,
    corners:stats.corners,
    cards:stats.cards,
    updatedAt:new Date().toISOString()
  };
  return true;
}
async function updateScoresFromApi(){
  const config=STATE.apiConfig || {};
  if(!config.apiKey){
    toast('Falta API key');
    alert('Para actualizar marcadores automáticamente debes pegar una API key de API-Football en la sección Acerca. En GitHub Pages la key queda visible; para producción es mejor usar un backend/proxy.');
    return;
  }
  const mapped=Object.entries(API_FOOTBALL_FIXTURE_IDS);
  if(mapped.length===0){
    toast('Faltan fixture IDs');
    alert('Ya dejé la función de actualización automática lista, pero falta completar el mapa API_FOOTBALL_FIXTURE_IDS con los IDs reales de cada partido de tu proveedor. Sin esos IDs la app no puede saber qué partido externo corresponde a cada partido interno.');
    return;
  }
  let updated=0;
  for(const [localId,externalId] of mapped){
    const url=`https://v3.football.api-sports.io/fixtures?id=${externalId}`;
    const res=await fetch(url,{headers:{'x-apisports-key':config.apiKey}});
    if(!res.ok) continue;
    const data=await res.json();
    const fixture=data.response?.[0];
    if(applyLiveFixture(localId,fixture)) updated++;
  }
  save(); refreshAll(); toast(`${updated} partidos actualizados`);
}

/* ---------- exportación ---------- */
function downloadTextFile(filename, content, mimeType){
  const blob=new Blob([content],{type:mimeType});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
function exportStateJson(){
  const payload={version:STATE_VERSION,dataUpdatedAt:DATA_UPDATED_AT,resultsUpdatedAt:RESULTS_UPDATED_AT,state:STATE,elo:ELO};
  downloadTextFile('oraculo-2026-estado.json',JSON.stringify(payload,null,2),'application/json');
  toast('JSON exportado');
}
function exportFixturesCsv(){
  const rows=[['grupo','jornada','local','visitante','goles_local','goles_visitante','estado']];
  FIXTURES.forEach(f=>{
    const r=STATE.results[f.id];
    rows.push([f.group,f.md,TEAMS_BY_CODE[f.home].name,TEAMS_BY_CODE[f.away].name,r?r[0]:'',r?r[1]:'',r?'jugado':'pendiente']);
  });
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
  downloadTextFile('oraculo-2026-calendario.csv',csv,'text/csv;charset=utf-8');
  toast('CSV exportado');
}

/* ---------- init ---------- */
function init(){
  const updatedEl=document.getElementById('dataUpdatedAt'); if(updatedEl)updatedEl.textContent=DATA_UPDATED_AT;
  const resultsEl=document.getElementById('resultsUpdatedAt'); if(resultsEl)resultsEl.textContent=RESULTS_UPDATED_AT;
  fillSelect(document.getElementById('selA'),'COL');
  fillSelect(document.getElementById('selB'),'POR');
  // filtro calendario
  const cf=document.getElementById('calFilter');
  cf.innerHTML=`<option value="ALL">Todos los grupos</option>`+GROUPS.map(g=>`<option value="${g}" ${g==='K'?'selected':''}>Grupo ${g}${g==='K'?' (Colombia)':''}</option>`).join("");
  cf.value='K';

  // tabs
  document.getElementById('nav').addEventListener('click',e=>{
    const b=e.target.closest('.tab'); if(!b)return;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('section').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); document.getElementById(b.dataset.t).classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('selA').addEventListener('change',renderPred);
  document.getElementById('selB').addEventListener('change',renderPred);
  document.getElementById('homeAdv').addEventListener('change',renderPred);
  document.getElementById('swapBtn').addEventListener('click',()=>{
    const a=document.getElementById('selA'),b=document.getElementById('selB');
    const tmp=a.value;a.value=b.value;b.value=tmp;renderPred();
  });
  document.getElementById('calFilter').addEventListener('change',renderCal);
  document.getElementById('updateApiBtn').addEventListener('click',updateScoresFromApi);
  document.getElementById('updateApiBtnInfo').addEventListener('click',updateScoresFromApi);
  document.getElementById('saveApiBtn').addEventListener('click',saveApiConfig);
  renderApiConfig();
  document.getElementById('exportJsonBtn').addEventListener('click',exportStateJson);
  document.getElementById('exportCsvBtn').addEventListener('click',exportFixturesCsv);
  document.getElementById('resetBtn').addEventListener('click',()=>{
    STATE.results=JSON.parse(JSON.stringify(SEED));save();refreshAll();toast('Resultados reiniciados');
  });
  document.getElementById('resetElo').addEventListener('click',()=>{
    STATE.eloOverride={};save();recomputeElo();refreshAll();toast('Elo base restaurado');
  });

  // modal
  document.getElementById('meSave').addEventListener('click',()=>{
    if(!curId)return; const a=parseInt(document.getElementById('meA').value)||0,b=parseInt(document.getElementById('meB').value)||0;
    STATE.results[curId]=[a,b];save();closeModal();refreshAll();toast('Marcador guardado');
  });
  document.getElementById('meClear').addEventListener('click',()=>{
    if(!curId)return; delete STATE.results[curId];save();closeModal();refreshAll();toast('Marcador borrado');
  });
  document.getElementById('meCancel').addEventListener('click',closeModal);
  document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});

  recomputeElo(); refreshAll();
}
init();