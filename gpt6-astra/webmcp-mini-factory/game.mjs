/**
 * WebMCP Mini Factory — depth-4 campaign simulation (static ESM).
 * Side-effect boot on import; shares FactoryEngine with human UI and WebMCP tools.
 */
import {
  DAILY_LEVEL_ID,
  GATED_RECIPES,
  LEVELS,
  LEGACY_LAYOUT_KEY,
  MACHINE_POWER,
  RESEARCH,
  STORAGE_KEY,
  canAffordPower,
  canEnablePower,
  dailyBlueprint,
  emptyProgress,
  formatDailyShareText,
  getLevel,
  hasResearch,
  isLevelUnlocked,
  maxMachineLevel,
  migrateProgress,
  minerCycleMult,
  nextLevelId,
  powerDiscount,
  powerDraw,
  powerUsed,
  productLabel,
  recordClear,
  recordDailyClear,
  storageMult,
  taipeiDateKey,
  totalStars,
  unlockedMachineTypes,
  unlockedRecipes,
} from './rules.mjs';
import {
  playBuild,
  playError,
  playMove,
  playResearch,
  playSelect,
  playStar,
  playWin,
} from '../shared/sfx.mjs';
import { createResultOverlay } from '../shared/result-overlay.mjs';


/* CONFIG, RESOURCE DATA, RECIPES, MACHINE DEFINITIONS */
const CONFIG = {width:10,height:8,tick:.25,window:60};
const RESOURCES = {
  iron_ore:{name:"Iron ore",color:"#b5c9d7",symbol:"◆"},
  copper_ore:{name:"Copper ore",color:"#e6a273",symbol:"◆"},
  iron_plate:{name:"Iron plate",color:"#c9e1ea",symbol:"▰"},
  copper_plate:{name:"Copper plate",color:"#efb084",symbol:"▰"},
  gear:{name:"Gear",color:"#8de5c1",symbol:"⚙"},
  circuit:{name:"Circuit",color:"#a99de6",symbol:"▦"},
  robot:{name:"Robot",color:"#7ec8e8",symbol:"🤖"},
  wire:{name:"Wire",color:"#e8c56a",symbol:"⌁"},
  motor:{name:"Motor",color:"#7ed4b0",symbol:"◎"}
};
const RECIPES = {
  iron_ore:{machine:"miner",inputs:{},outputs:{iron_ore:1},cycleTime:1.5},
  copper_ore:{machine:"miner",inputs:{},outputs:{copper_ore:1},cycleTime:1.5},
  iron_plate:{machine:"smelter",inputs:{iron_ore:1},outputs:{iron_plate:1},cycleTime:5},
  copper_plate:{machine:"smelter",inputs:{copper_ore:1},outputs:{copper_plate:1},cycleTime:5},
  gear:{machine:"assembler",inputs:{iron_plate:2},outputs:{gear:1},cycleTime:3},
  circuit:{machine:"assembler",inputs:{iron_plate:1,copper_plate:2},outputs:{circuit:1},cycleTime:4},
  robot:{machine:"robot_assembler",inputs:{gear:2,circuit:1},outputs:{robot:1},cycleTime:5},
  wire:{machine:"assembler",inputs:{copper_plate:1},outputs:{wire:2},cycleTime:2},
  motor:{machine:"assembler",inputs:{gear:1,wire:2},outputs:{motor:1},cycleTime:4}
};
const DEFINITIONS = {
  miner:{name:"Miner",cost:200,capacity:12,icon:"⛏"},
  smelter:{name:"Smelter",cost:180,capacity:12,icon:"♨"},
  assembler:{name:"Assembler",cost:250,capacity:12,icon:"⚙"},
  robot_assembler:{name:"Robot assembler",cost:320,capacity:12,icon:"🤖"},
  storage:{name:"Storage",cost:100,capacity:1000,icon:"▣"},
  splitter:{name:"Splitter",cost:90,capacity:24,icon:"⑂"}
};
const NODES = [{x:1,y:2,resource:"iron_ore"},{x:1,y:5,resource:"iron_ore"},{x:4,y:6,resource:"copper_ore"},{x:8,y:0,resource:"copper_ore"}];
const MACHINE_MULT = [0,1,1.5,2];
const BELT_MULT = [0,1,2,3];
const MACHINE_UPGRADE = [0,150,250];
const BELT_UPGRADE = [0,60,100];
const clone = x => JSON.parse(JSON.stringify(x));
const sum = b => Object.values(b).reduce((a,n)=>a+n,0);
const key = p => p.x+","+p.y;
const same = (a,b) => a.x===b.x && a.y===b.y;
const round = n => Math.round(n*10)/10;
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = id => document.getElementById(id);
const assertValid = (condition,message,extra={}) => {if(!condition) throw Object.assign(new Error(message),extra)};
const inside = p => Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<10&&p.y>=0&&p.y<8;
const isRelay = m => m.type==="storage"||m.type==="splitter";
const machineIdPattern = /^[a-z_]+-\d+$/;
function newMachine(id,type,x,y,recipe=null){
  return {id,type,x,y,online:true,level:1,recipe,inputBuffer:{},outputBuffer:{},capacity:DEFINITIONS[type].capacity,productionRate:0,efficiency:0,status:"IDLE",connections:{inputs:[],outputs:[]},progress:0,route:0};
}
function newConveyor(id,from,to,path,level=1){
  return {id,fromMachineId:from,toMachineId:to,path,level,capacity:8*BELT_MULT[level],throughput:0,utilization:0,credit:0,items:[],transportedResource:null};
}
function missionBlob(){
  return {held:0,complete:false,completedAt:null,settled:false,powerPeak:0};
}
/** Deterministic starter layouts keyed by level.starter. Classic matches depth-3 L01. */
function buildStarter(level){
  const credits=level.credits;
  const classic=()=>{
    const machines=[
      newMachine("miner-1","miner",1,2,"iron_ore"),
      newMachine("smelter-1","smelter",4,2,"iron_plate"),
      newMachine("assembler-1","assembler",7,2,"gear"),
      newMachine("storage-1","storage",8,5)
    ];
    return {machines,conveyors:[
      newConveyor("conveyor-1","miner-1","smelter-1",[{x:1,y:2},{x:2,y:2},{x:3,y:2},{x:4,y:2}],3),
      newConveyor("conveyor-2","smelter-1","assembler-1",[{x:4,y:2},{x:5,y:2},{x:6,y:2},{x:7,y:2}],1),
      newConveyor("conveyor-3","assembler-1","storage-1",[{x:7,y:2},{x:8,y:2},{x:8,y:3},{x:8,y:4},{x:8,y:5}],2)
    ]};
  };
  const copper_seed=()=>{
    const machines=[
      newMachine("miner-1","miner",1,2,"iron_ore"),
      newMachine("smelter-1","smelter",4,2,"iron_plate"),
      newMachine("miner-2","miner",4,6,"copper_ore"),
      newMachine("smelter-2","smelter",7,6,"copper_plate"),
      newMachine("assembler-1","assembler",7,2,"circuit"),
      newMachine("storage-1","storage",8,4)
    ];
    return {machines,conveyors:[
      newConveyor("conveyor-1","miner-1","smelter-1",[{x:1,y:2},{x:2,y:2},{x:3,y:2},{x:4,y:2}],2),
      newConveyor("conveyor-2","miner-2","smelter-2",[{x:4,y:6},{x:5,y:6},{x:6,y:6},{x:7,y:6}],2),
      newConveyor("conveyor-3","smelter-1","assembler-1",[{x:4,y:2},{x:5,y:2},{x:6,y:2},{x:7,y:2}],1)
    ]};
  };
  const circuit_seed=()=>{
    const machines=[
      newMachine("miner-1","miner",1,2,"iron_ore"),
      newMachine("smelter-1","smelter",3,2,"iron_plate"),
      newMachine("miner-2","miner",1,5,"iron_ore"),
      newMachine("smelter-2","smelter",3,5,"iron_plate"),
      newMachine("miner-3","miner",4,6,"copper_ore"),
      newMachine("smelter-3","smelter",6,6,"copper_plate"),
      newMachine("assembler-1","assembler",7,3,"circuit"),
      newMachine("storage-1","storage",9,3)
    ];
    return {machines,conveyors:[
      newConveyor("conveyor-1","miner-1","smelter-1",[{x:1,y:2},{x:2,y:2},{x:3,y:2}],2),
      newConveyor("conveyor-2","miner-2","smelter-2",[{x:1,y:5},{x:2,y:5},{x:3,y:5}],2),
      newConveyor("conveyor-3","miner-3","smelter-3",[{x:4,y:6},{x:5,y:6},{x:6,y:6}],2),
      newConveyor("conveyor-4","smelter-1","assembler-1",[{x:3,y:2},{x:4,y:2},{x:5,y:2},{x:6,y:2},{x:7,y:2},{x:7,y:3}],1),
      newConveyor("conveyor-5","smelter-3","assembler-1",[{x:6,y:6},{x:7,y:6},{x:7,y:5},{x:7,y:4},{x:7,y:3}],1),
      newConveyor("conveyor-6","assembler-1","storage-1",[{x:7,y:3},{x:8,y:3},{x:9,y:3}],2)
    ]};
  };
  const robot_seed=()=>{
    const machines=[
      newMachine("miner-1","miner",1,2,"iron_ore"),
      newMachine("smelter-1","smelter",3,2,"iron_plate"),
      newMachine("assembler-1","assembler",5,2,"gear"),
      newMachine("miner-2","miner",4,6,"copper_ore"),
      newMachine("smelter-2","smelter",6,6,"copper_plate"),
      newMachine("assembler-2","assembler",8,5,"circuit"),
      newMachine("robot_assembler-1","robot_assembler",8,2,"robot"),
      newMachine("storage-1","storage",9,4)
    ];
    return {machines,conveyors:[
      newConveyor("conveyor-1","miner-1","smelter-1",[{x:1,y:2},{x:2,y:2},{x:3,y:2}],2),
      newConveyor("conveyor-2","smelter-1","assembler-1",[{x:3,y:2},{x:4,y:2},{x:5,y:2}],2),
      newConveyor("conveyor-3","miner-2","smelter-2",[{x:4,y:6},{x:5,y:6},{x:6,y:6}],2),
      newConveyor("conveyor-4","assembler-1","robot_assembler-1",[{x:5,y:2},{x:6,y:2},{x:7,y:2},{x:8,y:2}],1),
      newConveyor("conveyor-5","smelter-2","assembler-2",[{x:6,y:6},{x:7,y:6},{x:8,y:6},{x:8,y:5}],1)
    ]};
  };
  const wire_seed=()=>{
    const machines=[
      newMachine("miner-1","miner",4,6,"copper_ore"),
      newMachine("smelter-1","smelter",6,6,"copper_plate"),
      newMachine("assembler-1","assembler",8,5,"wire"),
      newMachine("storage-1","storage",9,3)
    ];
    return {machines,conveyors:[
      newConveyor("conveyor-1","miner-1","smelter-1",[{x:4,y:6},{x:5,y:6},{x:6,y:6}],2),
      newConveyor("conveyor-2","smelter-1","assembler-1",[{x:6,y:6},{x:7,y:6},{x:8,y:6},{x:8,y:5}],1),
      newConveyor("conveyor-3","assembler-1","storage-1",[{x:8,y:5},{x:9,y:5},{x:9,y:4},{x:9,y:3}],1)
    ]};
  };
  const motor_seed=()=>{
    const machines=[
      newMachine("miner-1","miner",1,2,"iron_ore"),
      newMachine("smelter-1","smelter",3,2,"iron_plate"),
      newMachine("assembler-1","assembler",5,2,"gear"),
      newMachine("miner-2","miner",4,6,"copper_ore"),
      newMachine("smelter-2","smelter",6,6,"copper_plate"),
      newMachine("assembler-2","assembler",8,6,"wire"),
      newMachine("assembler-3","assembler",8,3,"motor"),
      newMachine("storage-1","storage",9,3)
    ];
    return {machines,conveyors:[
      newConveyor("conveyor-1","miner-1","smelter-1",[{x:1,y:2},{x:2,y:2},{x:3,y:2}],2),
      newConveyor("conveyor-2","smelter-1","assembler-1",[{x:3,y:2},{x:4,y:2},{x:5,y:2}],2),
      newConveyor("conveyor-3","miner-2","smelter-2",[{x:4,y:6},{x:5,y:6},{x:6,y:6}],2),
      newConveyor("conveyor-4","smelter-2","assembler-2",[{x:6,y:6},{x:7,y:6},{x:8,y:6}],1),
      newConveyor("conveyor-5","assembler-1","assembler-3",[{x:5,y:2},{x:6,y:2},{x:7,y:2},{x:8,y:2},{x:8,y:3}],1),
      newConveyor("conveyor-6","assembler-2","assembler-3",[{x:8,y:6},{x:8,y:5},{x:8,y:4},{x:8,y:3}],1)
    ]};
  };
  const blank=()=>({machines:[],conveyors:[]});
  const builders={classic,copper_seed,circuit_seed,robot_seed,wire_seed,motor_seed,blank};
  const built=(builders[level.starter]||classic)();
  return {
    version:1,credits,time:0,speed:1,serial:2,
    levelId:level.id,machines:built.machines,conveyors:built.conveyors,
    events:[],history:[],mission:missionBlob(),lastSample:0
  };
}
function initialState(level=getLevel("L01")){
  return buildStarter(level||getLevel("L01"));
}

/* ACTIVITY LOGGER */
class ActivityLogger {
  constructor(){this.entries=[];this.trail=[];this.version=0;this.onChange=null}
  add(source,message){
    this.entries.push({time:new Date().toLocaleTimeString("en-GB"),source,message});
    this.entries=this.entries.slice(-50);this.version++;this.onChange?.();
  }
  decision(message){this.trail.push(message);this.trail=this.trail.slice(-7);this.version++}
}

/* UNDO MANAGER: configuration snapshots never restore the simulation clock or event history. */
class UndoManager {
  constructor(){this.stack=[]}
  push(config){this.stack.push(config);if(this.stack.length>35)this.stack.shift()}
  pop(){assertValid(this.stack.length,"Nothing to undo.");return this.stack.pop()}
  clear(){this.stack=[]}
}

/* PRODUCTION ENGINE */
class ProductionEngine {
  static cycleTime(engine,m,recipe){
    const base=recipe.cycleTime/MACHINE_MULT[m.level];
    if(m.type==="miner")return base*minerCycleMult(engine.progress);
    return base;
  }
  static capacityFor(engine,m){
    const base=DEFINITIONS[m.type].capacity*MACHINE_MULT[m.level];
    if(m.type==="storage")return base*storageMult(engine.progress);
    return base;
  }
  static step(engine,dt){
    const s=engine.s;
    for(const m of s.machines){
      m.capacity=ProductionEngine.capacityFor(engine,m);
      if(!m.online){m.status="OFFLINE";continue}
      if(isRelay(m)){
        m.status=sum(m.inputBuffer)>=m.capacity?"BLOCKED":sum(m.inputBuffer)>0?"WORKING":"IDLE";continue;
      }
      const r=RECIPES[m.recipe];
      if(!r){m.status="IDLE";continue}
      if(sum(m.outputBuffer)+sum(r.outputs)>m.capacity){m.status="BLOCKED";continue}
      if(Object.entries(r.inputs).some(([resource,n])=>(m.inputBuffer[resource]||0)<n)){m.status="STARVED";continue}
      m.status="WORKING";
      m.progress+=dt;
      const cycle=ProductionEngine.cycleTime(engine,m,r);
      if(m.progress+1e-9>=cycle){
        m.progress=Math.max(0,m.progress-cycle);
        for(const [resource,n] of Object.entries(r.inputs)){
          m.inputBuffer[resource]-=n;
          engine.record({kind:"consumed",resource,n,machineId:m.id});
        }
        for(const [resource,n] of Object.entries(r.outputs)){
          m.outputBuffer[resource]=(m.outputBuffer[resource]||0)+n;
          engine.record({kind:"produced",resource,n,machineId:m.id});
        }
      }
    }
  }
}

/* FLOW ENGINE: finite-rate belts, actual in-flight items, fair output selection. */
class FlowEngine {
  static stock(m){return isRelay(m)?m.inputBuffer:m.outputBuffer}
  static accepts(m,resource){
    return isRelay(m)||Boolean(RECIPES[m.recipe]?.inputs[resource]);
  }
  static possibleOutputs(engine,m,visited=new Set()){
    if(visited.has(m.id))return [];
    visited.add(m.id);
    if(!isRelay(m))return Object.keys(RECIPES[m.recipe]?.outputs||{});
    const resources=new Set(Object.keys(m.inputBuffer));
    for(const c of engine.s.conveyors.filter(c=>c.toMachineId===m.id)){
      const source=engine.s.machines.find(a=>a.id===c.fromMachineId);
      if(source)for(const r of this.possibleOutputs(engine,source,visited))resources.add(r);
    }
    return [...resources];
  }
  static step(engine,dt){
    const s=engine.s;
    for(const c of s.conveyors){
      c.capacity=8*BELT_MULT[c.level];
      c.credit=Math.min(1,c.credit+dt*c.capacity/60);
      const dest=engine.machine(c.toMachineId);
      for(const item of c.items)item.remaining=Math.max(0,item.remaining-dt);
      while(c.items.length && c.items[0].remaining<=0){
        const item=c.items[0];
        if(!dest.online||!this.accepts(dest,item.resource)||sum(dest.inputBuffer)>=dest.capacity)break;
        dest.inputBuffer[item.resource]=(dest.inputBuffer[item.resource]||0)+1;
        c.transportedResource=item.resource;c.items.shift();
        engine.record({kind:"flow",resource:item.resource,n:1,conveyorId:c.id,fromMachineId:c.fromMachineId,toMachineId:c.toMachineId});
      }
    }
    for(const m of s.machines){
      if(!m.online)continue;
      const outgoing=s.conveyors.filter(c=>c.fromMachineId===m.id);
      if(!outgoing.length)continue;
      const start=m.route%outgoing.length;
      for(let i=0;i<outgoing.length;i++){
        const c=outgoing[(start+i)%outgoing.length];
        if(c.credit<1-1e-9||c.items.length>=Math.max(2,c.path.length-1))continue;
        const dest=engine.machine(c.toMachineId);
        const stock=this.stock(m);
        const resource=Object.keys(stock).find(r=>stock[r]>0&&this.accepts(dest,r));
        if(!resource)continue;
        const duration=(c.path.length-1)*.6;
        stock[resource]--;c.credit=0;
        c.items.push({resource,remaining:duration,duration});
        c.transportedResource=resource;
        m.route=(start+i+1)%outgoing.length;
      }
    }
  }
  static path(engine,from,to){
    const blocked=new Set(engine.s.machines.filter(m=>m.id!==from.id&&m.id!==to.id).map(key));
    for(const c of engine.s.conveyors)for(const p of c.path.slice(1,-1))blocked.add(key(p));
    const queue=[[{x:from.x,y:from.y}]],seen=new Set([key(from)]);
    for(let i=0;i<queue.length;i++){
      const path=queue[i],last=path[path.length-1];
      if(same(last,to))return path;
      for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
        const p={x:last.x+dx,y:last.y+dy},k=key(p);
        if(!inside(p)||seen.has(k)||blocked.has(k))continue;
        seen.add(k);queue.push([...path,p]);
      }
    }
    throw new Error("No valid conveyor path exists between these machines.");
  }
}

/* MISSION ENGINE AND SIMULATION ENGINE */
class MissionEngine {
  static step(engine,dt){
    const level=engine.level();
    const product=level.product;
    const target=level.target;
    const sustain=level.sustain;
    const s=engine.s,rate=engine.rate("produced",product);
    const recent=engine.rate("produced",product,null,10);
    s.mission.held=rate>=target&&recent>=target?s.mission.held+dt:0;
    const used=powerUsed(s.machines,MACHINE_POWER,engine.progress);
    s.mission.powerPeak=Math.max(s.mission.powerPeak||0,used);
    if(!s.mission.complete&&s.mission.held>=sustain){
      s.mission.complete=true;s.mission.completedAt=s.time;
      engine.logger?.add("System",`Mission complete — sustained ${productLabel(product)} production reached target.`);
      engine.logger?.decision("Target reached");
      engine.onMissionComplete?.();
    }
  }
}
class SimulationEngine {
  constructor(engine){this.engine=engine;this.timer=null}
  step(dt=CONFIG.tick){
    const e=this.engine,s=e.s;s.time+=dt;
    ProductionEngine.step(e,dt);FlowEngine.step(e,dt);
    s.events=s.events.filter(v=>v.t>s.time-60);
    if(s.time-s.lastSample>=1){
      s.lastSample=s.time;e.refreshMetrics();
      const product=e.level().product;
      const rate=e.rate("produced",product);
      s.history.push({t:s.time,value:rate});s.history=s.history.filter(p=>p.t>=s.time-60);
      if(e.logger&&e.lastAnnouncedRate!==undefined&&Math.abs(rate-e.lastAnnouncedRate)>=2){
        e.logger.add("Factory",`${RESOURCES[product]?.name||product} throughput ${rate>=e.lastAnnouncedRate?"increased":"changed"} to ${rate.toFixed(1)}/min.`);
        e.lastAnnouncedRate=rate;
      }
    }
    MissionEngine.step(e,dt);
  }
  start(){
    if(this.timer)return;
    this.timer=setInterval(()=>{
      for(let i=0;i<this.engine.s.speed;i++)this.step();
      this.engine.onTick?.();
    },CONFIG.tick*1000);
  }
}

/* BOTTLENECK ANALYZER: diagnostics are derived from current buffers, capacities and observations. */
class BottleneckAnalyzer {
  static analyze(engine){
    const s=engine.s,result=[],add=(type,id,message,observedRate,requiredRate,severity="medium",isConveyor=false)=>{
      const b={type,severity,message,observedRate:round(observedRate),requiredRate:round(requiredRate)};
      if(id)b[isConveyor?"conveyorId":"machineId"]=id;
      result.push(b);
    };
    for(const m of s.machines){
      const ins=s.conveyors.filter(c=>c.toMachineId===m.id),outs=s.conveyors.filter(c=>c.fromMachineId===m.id);
      const r=RECIPES[m.recipe],rate=engine.rate("produced",null,m.id);
      if(m.online&&r&&!outs.length)add("UNCONNECTED_MACHINE",m.id,`${m.id} has no output connection.`,0,engine.nominal(m));
      if(m.online&&r&&Object.keys(r.inputs).length&&!ins.length)add("UNCONNECTED_MACHINE",m.id,`${m.id} has no material supply.`,0,engine.nominal(m),"high");
      if(m.online&&m.status==="STARVED")add("INPUT_STARVATION",m.id,`${m.id} is waiting for ${Object.keys(r?.inputs||{}).filter(k=>(m.inputBuffer[k]||0)<r.inputs[k]).map(k=>RESOURCES[k].name).join(" + ")}.`,rate,engine.nominal(m));
      if(m.status==="BLOCKED")add("OUTPUT_BLOCKED",m.id,`${m.id} ${isRelay(m)?"storage":"output buffer"} is full.`,rate,engine.nominal(m));
      if(m.type==="storage"&&sum(m.inputBuffer)>=m.capacity*.85)add("OUTPUT_BLOCKED",m.id,`${m.id} is nearly full (${sum(m.inputBuffer)}/${m.capacity}).`,sum(m.inputBuffer),m.capacity,"high");
      if(m.online&&m.recipe==="iron_plate"&&outs.some(c=>engine.machine(c.toMachineId).recipe==="gear")){
        const combined=s.machines.filter(a=>a.online&&a.recipe==="iron_plate").reduce((n,a)=>n+engine.nominal(a),0);
        if(combined<20)add("MACHINE_CAPACITY",m.id,`Total iron smelting capacity is ${round(combined)}/min; the mission needs at least 20 plates/min.`,combined,20,"high");
      }
    }
    for(const c of s.conveyors){
      const source=engine.machine(c.fromMachineId),dest=engine.machine(c.toMachineId);
      const possible=FlowEngine.possibleOutputs(engine,source);
      const demand=dest.recipe==="gear"?20:dest.recipe==="iron_plate"?20:dest.recipe==="circuit"?16:dest.recipe==="robot"?12:dest.recipe==="wire"?18:dest.recipe==="motor"?14:possible.includes(engine.level().product)?engine.level().target:0;
      if(c.capacity<demand)add("CONVEYOR_CAPACITY",c.id,`${c.id} can carry ${c.capacity} items/min; this mission path needs ${demand}/min.`,c.throughput,demand,"high",true);
      else if(c.utilization>=.9)add("CONVEYOR_CAPACITY",c.id,`${c.id} is ${Math.round(c.utilization*100)}% utilized.`,c.throughput,c.capacity,"medium",true);
    }
    const level=engine.level();
    const rate=engine.rate("produced",level.product);
    if(rate<level.target)add("INSUFFICIENT_PRODUCTION",null,`${RESOURCES[level.product]?.name||level.product} production is ${round(level.target-rate)}/min below target.`,rate,level.target,"high");
    if(level.powerBudget!=null){
      const used=powerUsed(s.machines,MACHINE_POWER,engine.progress);
      if(used>level.powerBudget)add("POWER_OVERDRAW",null,`Online machines draw ${used} power; budget is ${level.powerBudget}.`,used,level.powerBudget,"high");
    }
    return result.sort((a,b)=>(a.severity==="high"?0:1)-(b.severity==="high"?0:1));
  }
}

/* FACTORY ENGINE: sole owner of shared simulation state and all application capabilities. */
class FactoryEngine {
  constructor({warm=true,logger=null,persistent=false,progress=null,levelId="L01"}={}){
    this.logger=logger;this.persistent=persistent;
    this.progress=progress||emptyProgress();
    this.campaignResearch=null;
    this.dailyBlueprint=null;
    if(this.progress.mode==="daily"){
      this.dailyBlueprint=dailyBlueprint();
      this.campaignResearch=[...(this.progress.research||[])];
      this.progress.research=[...(this.dailyBlueprint.researchGrant||[])];
    }else{
      this.progress.currentLevelId=getLevel(levelId)?levelId:this.progress.currentLevelId||"L01";
    }
    this.undo=new UndoManager();this.simulation=new SimulationEngine(this);
    this.onChange=null;this.onTick=null;this.onMissionComplete=null;
    this.s=initialState(this.level());
    if(warm)for(let i=0;i<180/CONFIG.tick;i++)this.simulation.step();
    this.refreshMetrics();this.lastAnnouncedRate=this.rate("produced",this.level().product);
  }
  isDaily(){return this.progress.mode==="daily"}
  level(){
    if(this.isDaily()){
      if(!this.dailyBlueprint||this.dailyBlueprint.dateKey!==taipeiDateKey()){
        this.dailyBlueprint=dailyBlueprint();
        this.progress.research=[...(this.dailyBlueprint.researchGrant||[])];
      }
      return this.dailyBlueprint;
    }
    return getLevel(this.s?.levelId||this.progress?.currentLevelId)||getLevel("L01");
  }
  machine(id){const m=this.s.machines.find(m=>m.id===id);assertValid(m,`Machine '${id}' does not exist.`);return m}
  conveyor(id){const c=this.s.conveyors.find(c=>c.id===id);assertValid(c,`Conveyor '${id}' does not exist.`);return c}
  record(event){this.s.events.push({t:this.s.time,...event})}
  rate(kind,resource=null,id=null,window=60){
    return this.s.events.filter(e=>e.kind===kind&&e.t>this.s.time-window&&(!resource||e.resource===resource)&&(!id||e.machineId===id||e.conveyorId===id)).reduce((n,e)=>n+e.n,0)*60/window;
  }
  nominal(m){
    if(!RECIPES[m.recipe])return 0;
    const cycle=ProductionEngine.cycleTime(this,m,RECIPES[m.recipe]);
    return cycle?60/cycle:0;
  }
  maxLevel(){return maxMachineLevel(this.progress)}
  allowedMachineSet(){
    const level=this.level();
    if(level.allowedMachines?.length)return new Set(level.allowedMachines);
    return new Set(unlockedMachineTypes(this.progress));
  }
  refreshMetrics(){
    for(const m of this.s.machines){
      m.capacity=ProductionEngine.capacityFor(this,m);
      m.productionRate=this.rate("produced",null,m.id);
      m.efficiency=this.nominal(m)?Math.min(1,m.productionRate/this.nominal(m)):0;
      m.connections={
        inputs:this.s.conveyors.filter(c=>c.toMachineId===m.id).map(c=>c.id),
        outputs:this.s.conveyors.filter(c=>c.fromMachineId===m.id).map(c=>c.id)
      };
    }
    for(const c of this.s.conveyors){
      c.capacity=8*BELT_MULT[c.level];c.throughput=this.rate("flow",null,c.id);c.utilization=Math.min(1,c.throughput/c.capacity);
    }
  }
  throughput(){
    const level=this.level();
    const out={window_seconds:60,measurement_age_seconds:Math.min(60,this.s.time),gear_target_per_min:level.product==="gear"?level.target:10,product:level.product,product_target_per_min:level.target,production:{},consumption:{}};
    for(const r of Object.keys(RESOURCES)){
      const p=round(this.rate("produced",r)),c=round(this.rate("consumed",r));
      out[r+"_per_min"]=p;out.production[r]=p;out.consumption[r]=c;
    }
    return out;
  }
  mission(){
    const level=this.level();
    const current=this.rate("produced",level.product);
    return {
      levelId:level.id,product:level.product,target:level.target,current:round(current),
      remainingGap:round(Math.max(0,level.target-current)),measurementWindowSeconds:60,
      sustainedSeconds:round(Math.min(level.sustain,this.s.mission.held)),
      requiredSustainedSeconds:level.sustain,complete:this.s.mission.complete,completedAt:this.s.mission.completedAt,
      powerPeak:this.s.mission.powerPeak||0
    };
  }
  constraints(){
    const level=this.level();
    const used=powerUsed(this.s.machines,MACHINE_POWER,this.progress);
    return {
      levelId:level.id,mode:this.progress.mode||"campaign",
      powerBudget:level.powerBudget,powerUsed:used,powerPeak:this.s.mission.powerPeak||0,powerDiscount:powerDiscount(this.progress),
      storageMult:storageMult(this.progress),minerCycleMult:minerCycleMult(this.progress),
      maxMachines:level.maxMachines,machineCount:this.s.machines.length,
      maxMachineLevel:this.maxLevel(),unlockedMachines:[...this.allowedMachineSet()],
      unlockedRecipes:unlockedRecipes(this.progress),machinePower:clone(MACHINE_POWER),
      allowedMachines:level.allowedMachines||null,dateKey:level.dateKey||null
    };
  }
  listLevels(){
    return {levels:LEVELS.map(level=>({
      id:level.id,index:level.index,title:level.title,blurb:level.blurb,product:level.product,
      target:level.target,sustain:level.sustain,unlocked:isLevelUnlocked(this.progress,level.id),
      stars:this.progress.clears[level.id]?.stars||0,current:!this.isDaily()&&level.id===this.level().id
    })),mode:this.progress.mode||"campaign"};
  }
  getProgress(){
    const dateKey=taipeiDateKey();
    const dailyEntry=this.progress.daily?.byDate?.[dateKey]||null;
    return {
      mode:this.progress.mode||"campaign",
      currentLevelId:this.progress.currentLevelId,totalStars:totalStars(this.progress),
      research:[...this.progress.research],clears:clone(this.progress.clears),
      level:this.level(),constraints:this.constraints(),
      daily:{
        dateKey,
        streak:this.progress.daily?.streak||0,
        lastClearedDate:this.progress.daily?.lastClearedDate||null,
        today:dailyEntry,
        blueprint:this.isDaily()?clone(this.level()):dailyBlueprint()
      }
    };
  }
  getDaily(){
    const blueprint=this.isDaily()?this.level():dailyBlueprint();
    const dateKey=blueprint.dateKey||taipeiDateKey();
    const entry=this.progress.daily?.byDate?.[dateKey]||null;
    return {
      dateKey,
      seed:blueprint.seed,
      blueprint:clone(blueprint),
      stars:entry?.stars||0,
      bestTime:entry?.bestTime??null,
      bestRate:entry?.bestRate??null,
      streak:this.progress.daily?.streak||0,
      shareText:formatDailyShareText(this.progress,blueprint),
      active:this.isDaily()
    };
  }
  getResearch(){
    return {research:RESEARCH.map(node=>({
      ...clone(node),unlocked:hasResearch(this.progress,node.id)
    })),unlockedIds:[...this.progress.research]};
  }
  inspectMachine(id){
    this.refreshMetrics();const m=this.machine(id);
    const max=this.maxLevel();
    return {...clone(m),nominalCapacityPerMin:round(this.nominal(m)),cycleTime:RECIPES[m.recipe]?round(ProductionEngine.cycleTime(this,m,RECIPES[m.recipe])):null,
      inputRate:round(this.s.events.filter(e=>e.kind==="flow"&&e.toMachineId===m.id).reduce((n,e)=>n+e.n,0)),
      outputRate:round(this.s.events.filter(e=>e.kind==="flow"&&e.fromMachineId===m.id).reduce((n,e)=>n+e.n,0)),
      connectedInputs:this.s.conveyors.filter(c=>c.toMachineId===id).map(c=>({conveyorId:c.id,machineId:c.fromMachineId})),
      connectedOutputs:this.s.conveyors.filter(c=>c.fromMachineId===id).map(c=>({conveyorId:c.id,machineId:c.toMachineId})),
      upgradeCost:m.level<max?MACHINE_UPGRADE[m.level]:null,maxMachineLevel:max
    };
  }
  inspectConveyor(id){
    this.refreshMetrics();const c=this.conveyor(id);
    return {...clone(c),currentFlow:c.throughput,travelTimeSeconds:(c.path.length-1)*.6,upgradeCost:c.level<3?BELT_UPGRADE[c.level]:null};
  }
  state(){
    this.refreshMetrics();
    return {grid:{width:10,height:8,resourceNodes:clone(NODES)},credits:this.s.credits,level:clone(this.level()),simulation:{time:round(this.s.time),speed:this.s.speed,tickSeconds:.25},machines:this.s.machines.map(m=>this.inspectMachine(m.id)),conveyors:clone(this.s.conveyors),recipes:clone(RECIPES),metrics:this.throughput(),mission:this.mission(),constraints:this.constraints(),resourceFlow:this.resourceFlow()};
  }
  resourceFlow(){
    return this.s.conveyors.map(c=>({conveyorId:c.id,fromMachineId:c.fromMachineId,toMachineId:c.toMachineId,resources:FlowEngine.possibleOutputs(this,this.machine(c.fromMachineId)),transportedResource:c.transportedResource,measuredFlowPerMin:round(this.rate("flow",null,c.id)),capacity:c.capacity,inTransit:c.items.length}));
  }
  available(){
    const unlocked=this.allowedMachineSet();
    const recipes=Object.fromEntries(Object.entries(RECIPES).filter(([id])=>unlockedRecipes(this.progress).includes(id)||RECIPES[id].machine==="miner"||RECIPES[id].machine==="smelter"||id==="gear"));
    const types=Object.fromEntries(Object.entries(DEFINITIONS).filter(([id])=>unlocked.has(id)));
    return {machineTypes:types,allMachineTypes:clone(DEFINITIONS),machineUpgradeCosts:{2:150,3:250},maxMachineLevel:this.maxLevel(),machineMultipliers:{1:1,2:1.5,3:2},conveyor:{costPerInteriorTile:15,minimumCost:15,capacityPerMin:{1:8,2:16,3:24},upgradeCosts:{2:60,3:100},routing:"Adjacent orthogonal cells; cannot cross machines or other belts."},bounds:{x:{min:0,max:9},y:{min:0,max:7}},resourceNodes:clone(NODES),recipes,allRecipes:clone(RECIPES),credits:this.s.credits,refundFraction:.5,constraints:this.constraints()};
  }
  spend(cost){assertValid(this.s.credits>=cost,"Insufficient credits.",{required:cost,available:this.s.credits});this.s.credits-=cost}
  nextId(type){
    let i=1;while([...this.s.machines,...this.s.conveyors].some(m=>m.id===type+"-"+i))i++;
    return type+"-"+i;
  }
  build({type,x,y}){
    assertValid(DEFINITIONS[type],`Invalid machine type '${type}'.`);
    assertValid(this.allowedMachineSet().has(type),`Machine type '${type}' is locked for this floor. Complete earlier levels or check today's daily kit.`);
    assertValid(inside({x,y}),"Coordinates must be integer tiles inside x: 0–9, y: 0–7.");
    assertValid(!this.s.machines.some(m=>m.x===x&&m.y===y),`Tile (${x},${y}) is already occupied.`);
    assertValid(!this.s.conveyors.some(c=>c.path.slice(1,-1).some(p=>p.x===x&&p.y===y)),`Tile (${x},${y}) contains a conveyor.`);
    const level=this.level();
    if(level.maxMachines!=null)assertValid(this.s.machines.length<level.maxMachines,`This floor allows at most ${level.maxMachines} machines.`);
    assertValid(canAffordPower(this.s.machines,type,level.powerBudget,MACHINE_POWER,this.progress),`Building ${type} would exceed the ${level.powerBudget} power budget.`);
    const node=NODES.find(n=>n.x===x&&n.y===y);
    if(type==="miner")assertValid(node,"Miners must be built on an iron or copper resource node.");
    this.spend(DEFINITIONS[type].cost);
    const m=newMachine(this.nextId(type),type,x,y,type==="miner"?node.resource:null);
    this.s.machines.push(m);
    return {machine:clone(m),machineId:m.id,cost:DEFINITIONS[type].cost};
  }
  remove({machineId}){
    const m=this.machine(machineId),refund=Math.floor(DEFINITIONS[m.type].cost*.5);
    this.s.conveyors=this.s.conveyors.filter(c=>c.fromMachineId!==machineId&&c.toMachineId!==machineId);
    this.s.machines=this.s.machines.filter(a=>a.id!==machineId);this.s.credits+=refund;
    return {machineId,refund,removedConnections:true};
  }
  recipe({machineId,recipe}){
    const m=this.machine(machineId),r=RECIPES[recipe];
    assertValid(r&&r.machine===m.type,`Recipe '${recipe}' is not supported by ${m.type}s.`);
    if(GATED_RECIPES.has(recipe)){
      assertValid(unlockedRecipes(this.progress).includes(recipe),`Recipe '${recipe}' is locked behind research.`);
    }
    if(m.type==="miner")assertValid(NODES.some(n=>same(n,m)&&n.resource===recipe),"Miner recipe must match the resource node.");
    const old=m.recipe;m.recipe=recipe;
    for(const c of this.s.conveyors){
      if(c.toMachineId===machineId){
        const outputs=FlowEngine.possibleOutputs(this,this.machine(c.fromMachineId));
        assertValid(outputs.some(res=>FlowEngine.accepts(m,res)),"Disconnect incompatible incoming conveyors before changing recipe.");
        assertValid(c.items.every(i=>FlowEngine.accepts(m,i.resource)),"An incompatible resource is still in transit.");
      }
      if(c.fromMachineId===machineId){
        const dest=this.machine(c.toMachineId);
        assertValid(Object.keys(r.outputs).some(res=>FlowEngine.accepts(dest,res)),"Disconnect incompatible outgoing conveyors before changing recipe.");
      }
    }
    m.progress=0;return {machineId,previousRecipe:old,recipe,bufferPolicy:"Existing buffered materials are retained."};
  }
  power({machineId,enabled}){
    const m=this.machine(machineId);
    if(enabled)assertValid(canEnablePower(this.s.machines,machineId,this.level().powerBudget,MACHINE_POWER,this.progress),`Enabling ${machineId} would exceed the power budget.`);
    m.online=enabled;m.status=enabled?"IDLE":"OFFLINE";return {machineId,online:enabled};
  }
  upgrade({machineId}){
    const m=this.machine(machineId),max=this.maxLevel();
    assertValid(m.level<max,"Machine is already at maximum level.");
    const cost=MACHINE_UPGRADE[m.level];this.spend(cost);m.level++;
    return {machineId,level:m.level,cost,nominalCapacityPerMin:round(this.nominal(m))};
  }
  connect({fromMachineId,toMachineId}){
    const from=this.machine(fromMachineId),to=this.machine(toMachineId);
    assertValid(from!==to,"A conveyor cannot connect a machine to itself.");
    assertValid(!this.s.conveyors.some(c=>c.fromMachineId===fromMachineId&&c.toMachineId===toMachineId),"These machines already have a direct connection.");
    if(from.type==="splitter")assertValid(this.s.conveyors.filter(c=>c.fromMachineId===from.id).length<2,"A splitter supports two outputs.");
    if(to.type==="splitter")assertValid(!this.s.conveyors.some(c=>c.toMachineId===to.id),"A splitter supports one input.");
    const resources=FlowEngine.possibleOutputs(this,from);
    assertValid((isRelay(from)&&resources.length===0&&to.type!=="miner")||resources.some(r=>FlowEngine.accepts(to,r)),"Source output is incompatible with destination recipe. Configure recipes first.");
    const path=FlowEngine.path(this,from,to),cost=Math.max(1,path.length-2)*15;
    this.spend(cost);
    const c=newConveyor(this.nextId("conveyor"),from.id,to.id,path);this.s.conveyors.push(c);
    return {conveyorId:c.id,path:clone(path),capacity:c.capacity,cost};
  }
  upgradeConveyor({conveyorId}){
    const c=this.conveyor(conveyorId);assertValid(c.level<3,"Conveyor is already at maximum level.");
    const cost=BELT_UPGRADE[c.level];this.spend(cost);c.level++;c.capacity=8*BELT_MULT[c.level];
    return {conveyorId,level:c.level,capacity:c.capacity,cost};
  }
  disconnect({conveyorId}){
    const c=this.conveyor(conveyorId),refund=Math.floor(Math.max(1,c.path.length-2)*15*.5);
    this.s.conveyors=this.s.conveyors.filter(v=>v.id!==conveyorId);this.s.credits+=refund;
    return {conveyorId,refund,inTransitItemsDiscarded:c.items.length};
  }
  configuration(){
    return {version:1,credits:this.s.credits,
      machines:this.s.machines.map(({id,type,x,y,online,level,recipe})=>({id,type,x,y,online,level,recipe})),
      conveyors:this.s.conveyors.map(({id,fromMachineId,toMachineId,path,level})=>({id,fromMachineId,toMachineId,path:clone(path),level}))
    };
  }
  applyConfiguration(config,preserveRuntime=true){
    const oldMachines=this.s.machines,oldBelts=this.s.conveyors;
    this.s.machines=config.machines.map(m=>{
      const existing=preserveRuntime?oldMachines.find(v=>v.id===m.id&&v.type===m.type):null;
      return {...(existing||newMachine(m.id,m.type,m.x,m.y,m.recipe)),...clone(m),progress:existing?.recipe===m.recipe?existing.progress:0};
    });
    this.s.conveyors=config.conveyors.map(c=>{
      const existing=preserveRuntime?oldBelts.find(v=>v.id===c.id&&v.fromMachineId===c.fromMachineId&&v.toMachineId===c.toMachineId):null;
      return {...(existing||newConveyor(c.id,c.fromMachineId,c.toMachineId,c.path,c.level)),...clone(c)};
    });
    this.s.credits=config.credits;this.s.mission.held=0;this.refreshMetrics();
  }
  bootLevel(levelId,{warm=true,config=null}={}){
    assertValid(!this.isDaily(),"Exit daily blueprint before selecting a campaign level.");
    const level=getLevel(levelId);assertValid(level,`Unknown level '${levelId}'.`);
    assertValid(isLevelUnlocked(this.progress,levelId),`Level ${levelId} is locked.`);
    this.progress.currentLevelId=levelId;
    this.undo.clear();
    if(config){
      this.s=initialState(level);this.s.events=[];this.s.history=[];this.s.time=0;this.s.mission=missionBlob();
      this.applyConfiguration(config,false);
    }else{
      this.s=initialState(level);
      if(warm)for(let i=0;i<180/CONFIG.tick;i++)this.simulation.step();
    }
    this.refreshMetrics();this.lastAnnouncedRate=this.rate("produced",level.product);
    return {levelId,credits:this.s.credits,message:`Loaded ${level.title}.`};
  }
  selectLevel({levelId}){
    if(this.isDaily()){
      this.stashLayout();
      if(this.campaignResearch)this.progress.research=[...this.campaignResearch];
      this.campaignResearch=null;
      this.dailyBlueprint=null;
      this.progress.mode="campaign";
    }else{
      this.stashLayout();
    }
    const saved=this.progress.layouts[levelId]||null;
    if(saved){
      try{validateSavedConfiguration(saved);return this.bootLevel(levelId,{warm:false,config:saved})}
      catch{/* fall through to starter */}
    }
    return this.bootLevel(levelId,{warm:true});
  }
  enterDaily(){
    if(this.isDaily()){
      const blueprint=this.level();
      return {mode:"daily",dateKey:blueprint.dateKey,message:`Already on today's daily blueprint (${blueprint.dateKey}).`,blueprint:clone(blueprint)};
    }
    this.stashLayout();
    this.campaignResearch=[...(this.progress.research||[])];
    this.dailyBlueprint=dailyBlueprint();
    this.progress.mode="daily";
    this.progress.research=[...(this.dailyBlueprint.researchGrant||[])];
    this.undo.clear();
    const dateKey=this.dailyBlueprint.dateKey;
    const saved=this.progress.daily?.layoutDate===dateKey?this.progress.daily.layout:null;
    if(saved){
      try{
        validateSavedConfiguration(saved);
        this.s=initialState(this.dailyBlueprint);this.s.events=[];this.s.history=[];this.s.time=0;this.s.mission=missionBlob();
        this.applyConfiguration(saved,false);
        this.refreshMetrics();this.lastAnnouncedRate=this.rate("produced",this.dailyBlueprint.product);
        return {mode:"daily",dateKey,credits:this.s.credits,message:`Loaded daily blueprint ${dateKey} (saved layout).`,blueprint:clone(this.dailyBlueprint)};
      }catch{/* fall through */}
    }
    this.s=initialState(this.dailyBlueprint);
    for(let i=0;i<180/CONFIG.tick;i++)this.simulation.step();
    this.refreshMetrics();this.lastAnnouncedRate=this.rate("produced",this.dailyBlueprint.product);
    return {mode:"daily",dateKey,credits:this.s.credits,message:`Loaded daily blueprint ${dateKey}.`,blueprint:clone(this.dailyBlueprint)};
  }
  exitDaily({preserveCampaignLoad=true}={}){
    assertValid(this.isDaily(),"Not currently on the daily blueprint.");
    this.stashLayout();
    if(this.campaignResearch)this.progress.research=[...this.campaignResearch];
    this.campaignResearch=null;
    this.dailyBlueprint=null;
    this.progress.mode="campaign";
    this.undo.clear();
    if(!preserveCampaignLoad)return {mode:"campaign",message:"Exited daily blueprint."};
    const levelId=getLevel(this.progress.currentLevelId)?this.progress.currentLevelId:"L01";
    const saved=this.progress.layouts[levelId]||null;
    if(saved){
      try{validateSavedConfiguration(saved);return {...this.bootLevel(levelId,{warm:false,config:saved}),mode:"campaign"}}
      catch{/* fall through */}
    }
    return {...this.bootLevel(levelId,{warm:true}),mode:"campaign"};
  }
  reset(){
    const level=this.level();
    this.s=initialState(level);
    for(let i=0;i<180/CONFIG.tick;i++)this.simulation.step();
    this.refreshMetrics();this.lastAnnouncedRate=this.rate("produced",level.product);
    return {message:`Deterministic ${level.id} starter factory restored.`,credits:this.s.credits,levelId:level.id};
  }
  settleClear(){
    if(!this.s.mission.complete||this.s.mission.settled)return null;
    this.s.mission.settled=true;
    const level=this.level();
    const attempt={
      machineCount:this.s.machines.length,
      powerPeak:this.s.mission.powerPeak||0,
      creditsLeft:this.s.credits,
      completeTime:this.s.mission.completedAt??this.s.time,
      rate:this.rate("produced",level.product)
    };
    if(this.isDaily()){
      const result=recordDailyClear(this.progress,level,attempt);
      this.stashLayout();this.save();
      return {...result,attempt,levelId:level.id,nextLevelId:null,daily:true,shareText:formatDailyShareText(this.progress,level)};
    }
    const result=recordClear(this.progress,level.id,attempt);
    this.stashLayout();this.save();
    return {...result,attempt,levelId:level.id,nextLevelId:nextLevelId(level.id),daily:false};
  }
  stashLayout(){
    if(this.isDaily()){
      if(!this.progress.daily)this.progress.daily={streak:0,lastClearedDate:null,byDate:{},layout:null,layoutDate:null};
      this.progress.daily.layout=this.configuration();
      this.progress.daily.layoutDate=this.level().dateKey||taipeiDateKey();
      return;
    }
    this.progress.layouts[this.level().id]=this.configuration();
    this.progress.currentLevelId=this.level().id;
  }
  invoke(name,args={},source="UI"){
    const tool=TOOLS.find(t=>t.name===name);
    let original=null,before=null,progressBefore=null;
    try{
      assertValid(tool,`Unknown factory capability '${name}'.`);
      validateSchema(args,tool.inputSchema,"arguments");
      this.logger?.add(source,`${name}${Object.keys(args).length?" "+JSON.stringify(args):"()"}`);
      if(!tool.readOnly){
        original=this.s;before=this.configuration();progressBefore=clone(this.progress);
        this.s=clone(original);
      }
      const data=tool.run(this,args);
      if(!tool.readOnly){
        if(name==="factory_reset"||name==="factory_select_level"||name==="factory_enter_daily"||name==="factory_exit_daily")this.undo.clear();
        else if(name!=="factory_undo"&&name!=="simulation_set_speed")this.undo.push(before);
        this.refreshMetrics();this.save();
        if(source==="WebMCP"){
          const labels={
            machine_upgrade:"Upgraded "+args.machineId,machine_build:"Added "+data.machineId,
            conveyor_connect:"Connected "+args.fromMachineId+" → "+args.toMachineId,
            conveyor_upgrade:"Upgraded "+args.conveyorId,machine_set_recipe:"Configured "+args.machineId,
            factory_select_level:"Selected "+args.levelId
          };
          this.logger?.decision(labels[name]||"Applied "+name);
        }
        this.logger?.add("System",`${name} succeeded${data.cost!==undefined?" · "+data.cost+" credits":""}.`);
      }else if(source==="WebMCP"){
        const labels={factory_get_throughput:"Checked production throughput",factory_get_bottlenecks:"Inspected derived bottlenecks",machine_inspect:"Inspected "+args.machineId,factory_get_state:"Observed shared factory state",factory_get_credits:"Checked available credits",factory_list_levels:"Listed campaign levels",factory_get_progress:"Checked campaign progress"};
        if(labels[name])this.logger?.decision(labels[name]);
      }
      const result={success:true,...clone(data)};
      this.onChange?.({name,args,result,source,mutation:!tool.readOnly});
      return result;
    }catch(error){
      if(original)this.s=original;
      if(progressBefore)this.progress=progressBefore;
      const result={success:false,error:error.message};
      if(error.required!==undefined){result.required=error.required;result.available=error.available}
      this.logger?.add(source,`${name} rejected: ${error.message}`);
      this.onChange?.({name,args,result,source,mutation:false});
      return result;
    }
  }
  save(){
    if(!this.persistent)return;
    try{
      this.stashLayout();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(this.progress));
      try{localStorage.removeItem(LEGACY_LAYOUT_KEY)}catch{/* ignore */}
      const el=$("saveStatus");if(el)el.textContent="Progress saved locally · simulation remains on this device";
    }catch{
      const el=$("saveStatus");if(el)el.textContent="Local storage unavailable · factory still playable";
    }
  }
  load(){
    try{
      let raw=null,legacy=null;
      try{raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch{raw=null}
      try{legacy=JSON.parse(localStorage.getItem(LEGACY_LAYOUT_KEY)||"null")}catch{legacy=null}
      this.progress=migrateProgress(raw,legacy);
      if(this.progress.mode==="daily"){
        this.campaignResearch=[...(this.progress.research||[])];
        // Research in save while daily may already be the grant; prefer campaign tree from clears.
        const campaignTree=[];
        for(const id of Object.keys(this.progress.clears||{})){
          if((this.progress.clears[id].stars||0)>=1){
            const level=getLevel(id);
            for(const rid of level?.unlockResearch||[]){
              if(!campaignTree.includes(rid))campaignTree.push(rid);
            }
          }
        }
        this.campaignResearch=campaignTree.length?campaignTree:[...(this.progress.research||[])];
        this.dailyBlueprint=dailyBlueprint();
        this.progress.research=[...(this.dailyBlueprint.researchGrant||[])];
        const dateKey=this.dailyBlueprint.dateKey;
        const saved=this.progress.daily?.layoutDate===dateKey?this.progress.daily.layout:null;
        if(saved){
          try{
            validateSavedConfiguration(saved);
            this.s=initialState(this.dailyBlueprint);this.s.events=[];this.s.history=[];this.s.time=0;this.s.mission=missionBlob();
            this.applyConfiguration(saved,false);
            this.refreshMetrics();this.lastAnnouncedRate=this.rate("produced",this.dailyBlueprint.product);
            this.logger?.add("System",`Daily blueprint ${dateKey} layout restored.`);
            return true;
          }catch{/* fall through */}
        }
        this.s=initialState(this.dailyBlueprint);
        for(let i=0;i<180/CONFIG.tick;i++)this.simulation.step();
        this.refreshMetrics();this.lastAnnouncedRate=this.rate("produced",this.dailyBlueprint.product);
        this.logger?.add("System",`Daily blueprint ${dateKey} loaded.`);
        return false;
      }
      const levelId=this.progress.currentLevelId;
      const saved=this.progress.layouts[levelId];
      if(saved){
        try{
          validateSavedConfiguration(saved);
          this.bootLevel(levelId,{warm:false,config:saved});
          this.logger?.add("System","Saved layout restored. Rolling measurement window is warming up.");
          return true;
        }catch{
          this.bootLevel(levelId,{warm:true});
          this.logger?.add("System","Saved layout invalid for current level; using starter floor.");
          return false;
        }
      }
      this.bootLevel(levelId,{warm:true});
      return false;
    }catch(error){
      this.progress=emptyProgress();
      this.bootLevel("L01",{warm:true});
      this.logger?.add("System","Saved progress unavailable; using deterministic L01 factory.");
      return false;
    }
  }
}

/* SCHEMA VALIDATION AND TOOL CATALOG */
function validateSchema(value,schema,path){
  if(schema.type==="object"){
    assertValid(value!==null&&typeof value==="object"&&!Array.isArray(value),`${path} must be an object.`);
    for(const name of schema.required||[])assertValid(Object.hasOwn(value,name),`${path}.${name} is required.`);
    for(const name of Object.keys(value)){
      assertValid(Object.hasOwn(schema.properties||{},name),`Unknown property ${path}.${name}.`);
      validateSchema(value[name],schema.properties[name],path+"."+name);
    }
  }else if(schema.type==="array"){
    assertValid(Array.isArray(value),`${path} must be an array.`);
    assertValid(value.length>=(schema.minItems||0)&&value.length<=(schema.maxItems||100),`${path} has an invalid item count.`);
    value.forEach((v,i)=>validateSchema(v,schema.items,`${path}[${i}]`));
  }else{
    assertValid(schema.type==="integer"?Number.isInteger(value):typeof value===schema.type,`${path} must be ${schema.type}.`);
    if(schema.minimum!==undefined)assertValid(value>=schema.minimum,`${path} must be at least ${schema.minimum}.`);
    if(schema.maximum!==undefined)assertValid(value<=schema.maximum,`${path} must be at most ${schema.maximum}.`);
    if(schema.minLength)assertValid(value.length>=schema.minLength,`${path} cannot be empty.`);
  }
  if(schema.enum)assertValid(schema.enum.includes(value),`${path} must be one of: ${schema.enum.join(", ")}.`);
}
const str={type:"string",minLength:1};
const machineId={...str,description:"Exact machine ID from machine_list or factory_get_state."};
const conveyorId={...str,description:"Exact conveyor ID from conveyor_list."};
const buildFields={
  type:{type:"string",enum:Object.keys(DEFINITIONS),description:"Machine class. New smelters and assemblers require machine_set_recipe."},
  x:{type:"integer",minimum:0,maximum:9,description:"Zero-based horizontal tile coordinate."},
  y:{type:"integer",minimum:0,maximum:7,description:"Zero-based vertical tile coordinate."}
};
const objectSchema=properties=>({type:"object",properties,required:Object.keys(properties),additionalProperties:false});
const TOOLS=[];
function defineTool(name,description,readOnly,properties,run){
  TOOLS.push({name,description,readOnly,inputSchema:objectSchema(properties),
    annotations:{readOnlyHint:readOnly,consequentialHint:!readOnly,untrustedContentHint:false,destructiveHint:!readOnly,idempotentHint:readOnly},
    run});
}
defineTool("factory_get_state","Get the current shared factory simulation: machines, buffers, statuses, levels, recipes, conveyors, resource flow, credits, rolling metrics, mission progress, resource nodes and simulation speed. Start here before making structural changes.",true,{},e=>e.state());
defineTool("factory_get_summary","Return a concise health summary with actual production rates, active bottlenecks, material shortages, blocked machines, credits and mission progress. Use for 'How is my factory doing?'.",true,{},e=>({metrics:e.throughput(),bottlenecks:BottleneckAnalyzer.analyze(e),shortages:e.s.machines.filter(m=>m.status==="STARVED").map(m=>m.id),blockedMachines:e.s.machines.filter(m=>m.status==="BLOCKED").map(m=>m.id),credits:e.s.credits,mission:e.mission()}));
defineTool("factory_get_throughput","Measure rolling production and consumption rates for all resources (including circuits and robots when unlocked) over the last 60 simulation seconds. Values exactly match the live dashboard. After an improvement, allow simulation time to advance before re-measuring; 4× speed can shorten the wait.",true,{},e=>e.throughput());
defineTool("factory_get_bottlenecks","Analyze actual factory capacities, buffers and flow. Return structured starvation, blocked output, insufficient smelting capacity, constrained conveyors, disconnected stages and target shortfall. Diagnostics inform decisions; this tool does not modify or optimize the factory.",true,{},e=>({bottlenecks:BottleneckAnalyzer.analyze(e)}));
defineTool("machine_list","List every machine with its ID, type, coordinates, recipe, power, level, status, input/output buffers and connected conveyor IDs.",true,{},e=>{e.refreshMetrics();return {machines:clone(e.s.machines)}});
defineTool("machine_inspect","Inspect one machine's live buffers, progress, efficiency, actual production, theoretical capacity, cycle time, connections and next upgrade cost. Use to verify whether capacity or missing materials limits it.",true,{machineId},(e,a)=>({machine:e.inspectMachine(a.machineId)}));
defineTool("machine_build","Build a new machine on a valid empty tile, spending simulated credits. Miners require resource nodes. Smelters, assemblers and robot assemblers start without a recipe; configure them and connect conveyors separately. Respects research unlocks, power budget and max-machine caps. Read factory_get_available_builds before choosing a location or cost.",false,buildFields,(e,a)=>e.build(a));
defineTool("machine_delete","Delete an existing machine and all incident conveyors. Refund 50% of the machine's base construction cost; contained and in-transit resources are discarded. This changes the shared factory and may interrupt production.",false,{machineId},(e,a)=>e.remove(a));
defineTool("machine_set_recipe","Configure a compatible production recipe. Miner recipes must match their node; smelters make plates; assemblers make gears or circuits (circuits need research); robot assemblers make robots. Incompatible existing connections are rejected; disconnect them first. Retains buffers and resets cycle progress.",false,{machineId,recipe:{type:"string",enum:Object.keys(RECIPES)}},(e,a)=>e.recipe(a));
defineTool("machine_set_power","Enable or disable one machine without deleting its layout or buffers. Disabled machines neither produce, accept arriving resources nor send resources. Enabling is rejected when it would exceed the level power budget.",false,{machineId,enabled:{type:"boolean"}},(e,a)=>e.power(a));
defineTool("machine_upgrade","Upgrade a machine by one level, to a maximum of 3. Production multipliers are 1×, 1.5× and 2×; levels 2 and 3 cost 150 and 250 credits. Storage and splitter upgrades increase buffer capacity. Inspect upstream supply and outgoing conveyors before spending.",false,{machineId},(e,a)=>e.upgrade(a));
defineTool("conveyor_connect","Connect compatible source and destination machines with an automatically routed adjacent-cell orthogonal conveyor. Routes cannot cross machines or other belts. New belts carry 8 items/min and cost 15 credits per interior tile, minimum 15. Configure recipes first; inspect and upgrade belts when capacity is insufficient.",false,{fromMachineId:machineId,toMachineId:machineId},(e,a)=>e.connect(a));
defineTool("conveyor_list","List all conveyor IDs, endpoints, paths, capacity, level, actual rolling throughput, utilization, resource type and in-flight items.",true,{},e=>{e.refreshMetrics();return {conveyors:clone(e.s.conveyors)}});
defineTool("conveyor_inspect","Inspect a conveyor's capacity, measured flow, utilization, level, source, destination, transported resource, travel time, in-flight items and upgrade cost.",true,{conveyorId},(e,a)=>({conveyor:e.inspectConveyor(a.conveyorId)}));
defineTool("conveyor_upgrade","Increase one conveyor's capacity by one level: 8 → 16 → 24 items/min. Level 2 costs 60 credits and level 3 costs 100. This only improves throughput when machines can supply and consume the additional material.",false,{conveyorId},(e,a)=>e.upgradeConveyor(a));
defineTool("conveyor_disconnect","Remove one conveyor, discard its in-flight items and refund half its route construction cost. Endpoints remain in place. Use before rerouting or changing to incompatible recipes.",false,{conveyorId},(e,a)=>e.disconnect(a));
defineTool("factory_get_recipes","Return deterministic ingredients, outputs, base cycle times and compatible machine classes. Machine levels shorten production cycles; belts and material supply may impose lower realized rates.",true,{},()=>({recipes:clone(RECIPES)}));
defineTool("factory_get_available_builds","Return machine types and base costs, machine and conveyor upgrade costs, level multipliers, grid bounds, resource node locations, recipes, routing constraints and current credits. Use this instead of guessing legal placement or budget.",true,{},e=>e.available());
defineTool("factory_get_resource_flow","Return source → conveyor → destination relationships with possible resources, recently transported resource, measured items/min, capacity and current in-transit count. Use to trace assembler shortages upstream.",true,{},e=>({flows:e.resourceFlow()}));
defineTool("factory_get_machine_efficiency","Return rolling realized production divided by theoretical production capacity for each producer, plus status and actual rate. Relay machines report input/output rates instead of production efficiency.",true,{},e=>({machines:e.s.machines.map(m=>{const a=e.inspectMachine(m.id);return {machineId:m.id,status:m.status,efficiency:a.efficiency,productionRate:a.productionRate,nominalCapacityPerMin:a.nominalCapacityPerMin,inputRate:a.inputRate,outputRate:a.outputRate}})}));
defineTool("factory_get_credits","Return the available simulated construction budget. No real currency is used and production does not generate additional credits.",true,{},e=>({credits:e.s.credits,currency:"simulated credits"}));
defineTool("simulation_set_speed","Set deterministic simulation speed to 0 (paused), 1, 2 or 4. Higher speed advances production and the rolling measurement window faster without changing recipes or per-simulation-minute capacity.",false,{speed:{type:"integer",enum:[0,1,2,4]}},(e,a)=>{e.s.speed=a.speed;return {speed:a.speed,paused:a.speed===0}});
defineTool("factory_batch_build","Atomically build multiple machines. All coordinates, occupancy, resource nodes and total credits are validated on an isolated draft before commit. If any build fails, no machine is added and no credits are spent. Configure recipes afterward.",false,{machines:{type:"array",minItems:1,maxItems:20,items:objectSchema(buildFields)}},(e,a)=>({builds:a.machines.map(m=>e.build(m))}));
defineTool("factory_batch_upgrade","Atomically upgrade distinct machines by one level each. Reject duplicate IDs, missing machines, max-level machines or insufficient total credits without partially applying upgrades. Conveyor upgrades are separate.",false,{machineIds:{type:"array",minItems:1,maxItems:30,items:machineId}},(e,a)=>{
  assertValid(new Set(a.machineIds).size===a.machineIds.length,"Batch upgrade IDs must be unique.");
  const machines=a.machineIds.map(id=>e.machine(id));
  const max=e.maxLevel();
  assertValid(machines.every(m=>m.level<max),"One or more machines are already at maximum level for current research.");
  const total=machines.reduce((n,m)=>n+MACHINE_UPGRADE[m.level],0);
  assertValid(e.s.credits>=total,"Insufficient credits.",{required:total,available:e.s.credits});
  return {upgrades:a.machineIds.map(machineId=>e.upgrade({machineId})),totalCost:total};
});
defineTool("factory_get_mission","Return the current level mission: product, target rate, current 60-second rate, remaining gap, sustained duration and latched completion. Completion requires both rolling and recent production to stay at target for the level's sustain window.",true,{},e=>e.mission());
defineTool("factory_list_levels","List campaign floors with unlock state, star rating, product targets and which level is currently loaded.",true,{},e=>e.listLevels());
defineTool("factory_get_progress","Return campaign progress: current level, total stars, research unlocks, personal-best clears and live constraints for the active floor.",true,{},e=>e.getProgress());
defineTool("factory_select_level","Switch to an unlocked campaign level. Saves the current layout into versioned progress, then loads that level's saved layout or its deterministic starter with warm-up.",false,{levelId:{type:"string",minLength:1,description:"Level id such as L01 or L08."}},(e,a)=>e.selectLevel(a));
defineTool("factory_get_research","List research nodes with unlock status. Research is granted by clearing levels and gates splitters, circuit/robot/wire/motor recipes, robot assemblers, Overclock, bulk storage and deep mining.",true,{},e=>e.getResearch());
defineTool("factory_get_constraints","Return the active floor's power budget, current power draw, power peak, Overclock discount, machine count cap, max machine level and unlocked machine/recipe sets.",true,{},e=>e.constraints());
defineTool("factory_get_daily","Return today's Asia/Taipei daily blueprint: product target, power/machine caps, allowed machines, research grant, today's best stars, streak and share text.",true,{},e=>e.getDaily());
defineTool("factory_enter_daily","Switch to today's date-seeded daily blueprint. Saves the campaign layout, applies today's research grant and kit limits, then loads the daily starter or saved daily layout.",false,{},e=>e.enterDaily());
defineTool("factory_exit_daily","Leave the daily blueprint and restore the campaign research tree plus the last campaign floor layout.",false,{},e=>e.exitDaily());
defineTool("factory_undo","Undo the last logical construction/configuration mutation by restoring its layout, levels, recipes, power and credits. Does not rewind simulation time, production history, existing buffers or individual transfers. Deleted/re-created machines return with empty buffers. Reset clears undo history.",false,{},e=>{e.applyConfiguration(e.undo.pop());return {message:"Previous configuration restored. Simulation time was not rewound."}});
defineTool("factory_reset","Restore the current level's deterministic starter factory with its credit budget and simulated warm-up baseline. Clears construction undo history and overwrites the saved layout for this level.",false,{},e=>e.reset());

/* PERSISTENCE VALIDATION */
function validateSavedConfiguration(c){
  assertValid(c&&c.version===1&&Number.isInteger(c.credits)&&c.credits>=0&&c.credits<=100000,"Invalid saved budget or version.");
  assertValid(Array.isArray(c.machines)&&c.machines.length<=80&&Array.isArray(c.conveyors)&&c.conveyors.length<=160,"Invalid saved entities.");
  const ids=new Set(),occupied=new Set();
  for(const m of c.machines){
    assertValid(m&&DEFINITIONS[m.type]&&typeof m.id==="string"&&machineIdPattern.test(m.id)&&!ids.has(m.id),"Invalid saved machine ID or type.");
    assertValid(inside(m)&&!occupied.has(key(m)),"Invalid saved machine position.");
    assertValid([1,2,3].includes(m.level)&&typeof m.online==="boolean","Invalid saved machine configuration.");
    assertValid(m.recipe===null||(RECIPES[m.recipe]?.machine===m.type),"Invalid saved recipe.");
    if(m.type==="miner")assertValid(NODES.some(n=>same(n,m)&&n.resource===m.recipe),"Invalid saved miner.");
    ids.add(m.id);occupied.add(key(m));
  }
  const beltTiles=new Set(),pairs=new Set(),temp=new FactoryEngine({warm:false});
  temp.s.machines=c.machines.map(m=>({...newMachine(m.id,m.type,m.x,m.y,m.recipe),...m}));
  temp.s.conveyors=c.conveyors.map(v=>({...v,items:[]}));
  for(const b of c.conveyors){
    assertValid(b&&typeof b.id==="string"&&/^conveyor-\d+$/.test(b.id)&&!ids.has(b.id)&&[1,2,3].includes(b.level),"Invalid saved conveyor.");
    const from=temp.machine(b.fromMachineId),to=temp.machine(b.toMachineId),pair=from.id+":"+to.id;
    assertValid(from!==to&&!pairs.has(pair),"Invalid or duplicate saved connection.");pairs.add(pair);
    assertValid(Array.isArray(b.path)&&b.path.length>=2&&b.path.length<=80&&same(b.path[0],from)&&same(b.path.at(-1),to),"Invalid saved path endpoints.");
    const seen=new Set();
    for(let i=0;i<b.path.length;i++){
      const p=b.path[i];
      assertValid(inside(p)&&!seen.has(key(p)),"Invalid saved path.");seen.add(key(p));
      if(i)assertValid(Math.abs(p.x-b.path[i-1].x)+Math.abs(p.y-b.path[i-1].y)===1,"Non-adjacent saved belt.");
      if(i>0&&i<b.path.length-1){
        assertValid(!occupied.has(key(p))&&!beltTiles.has(key(p)),"Saved paths overlap.");beltTiles.add(key(p));
      }
    }
    const resources=FlowEngine.possibleOutputs(temp,from);
    assertValid((isRelay(from)&&!resources.length&&to.type!=="miner")||resources.some(r=>FlowEngine.accepts(to,r)),"Incompatible saved connection.");
    ids.add(b.id);
  }
  for(const m of c.machines.filter(m=>m.type==="splitter")){
    assertValid(c.conveyors.filter(b=>b.toMachineId===m.id).length<=1&&c.conveyors.filter(b=>b.fromMachineId===m.id).length<=2,"Invalid splitter connections.");
  }
}

/* FACTORY RENDERER */
const ART = {
  miner:`<path d="M12 58h56v10H12z" fill="#192a36" stroke="#8ca5b5"/><path d="M21 50V15h12v35M51 50V15h12v35" fill="#496677" stroke="#9bb1bc" stroke-width="2"/><path d="M20 16h43v9H20z" fill="#a7bac5"/><g class="rotor"><path d="M35 29h14v23l-7 9-7-9z" fill="#b6d6df"/><path d="m34 32 17 6m-17 2 17 6m-17 2 15 6" stroke="#3d5764" stroke-width="3"/></g><path d="M13 61h54" stroke="#ffc079" stroke-width="3" stroke-dasharray="6 4"/>`,
  smelter:`<path d="M21 17h40v45H21z" fill="#292c2d" stroke="#a0a0a0" stroke-width="2"/><path d="M25 7h8v16h-8M49 7h8v16h-8" fill="#76828a" stroke="#262d34"/><path d="M28 31h26v22H28z" fill="#764631" stroke="#d89865" stroke-width="3"/><path class="hot" d="m32 50 3-12 7 6 5-13 5 19z" fill="#a46a41"/><path d="M17 59h48v8H17z" fill="#a09c8e"/><path d="M15 23h7v28h-7M60 23h7v28h-7" fill="#665a50"/>`,
  assembler:`<rect x="14" y="13" width="54" height="52" rx="5" fill="#23434a" stroke="#88b5b4" stroke-width="2"/><path d="M17 57h48M18 20h46" stroke="#6a8f91"/><g class="rotor"><path d="m37 24 9 0 2 6 6 2 5-3 6 8-5 5 0 6 5 3-5 8-6-3-6 2-1 6h-10l-2-6-6-2-5 3-6-8 5-4v-6l-5-4 5-8 6 3 6-2z" fill="#93b8b8" transform="translate(5 4) scale(.75)"/><circle cx="40" cy="39" r="9" fill="#25444b" stroke="#b3e5dd" stroke-width="2"/></g><circle cx="59" cy="57" r="3" fill="#80e5ad"/>`,
  storage:`<path d="M14 20 39 8l28 12v42L39 73 14 59z" fill="#756f51" stroke="#c5b989" stroke-width="2"/><path d="m14 20 25 13 28-13M39 33v40" fill="none" stroke="#c5b989" stroke-width="2"/><path d="m23 16 28 13v39M53 14 27 27v39" stroke="#353b32" stroke-width="6"/><path d="m43 42 16-6v12l-16 6z" fill="#aabc9c"/>`,
  splitter:`<rect x="13" y="14" width="54" height="50" rx="6" fill="#323955" stroke="#929abe" stroke-width="2"/><path d="M40 57V39M40 39 23 23M40 39 57 23" fill="none" stroke="#b4c9f3" stroke-width="7"/><path d="M22 34V22h12M46 22h12v12" fill="none" stroke="#b4c9f3" stroke-width="4"/>`,
  robot_assembler:`<rect x="12" y="12" width="56" height="54" rx="6" fill="#1f3a48" stroke="#7ec8e8" stroke-width="2"/><circle cx="40" cy="36" r="14" fill="#2a5160" stroke="#9ad7ef"/><path d="M40 22v28M26 36h28" stroke="#7ec8e8" stroke-width="3"/><path d="M22 58h36" stroke="#5ed7e8" stroke-width="4" stroke-dasharray="5 4"/><circle cx="28" cy="20" r="3" fill="#82e2ab"/><circle cx="52" cy="20" r="3" fill="#edcf78"/>`
};
class FactoryRenderer {
  constructor(engine,ui){
    this.engine=engine;this.ui=ui;this.machineElements=new Map();this.lastConveyorSignature="";this.highlightIds=new Map();this.lastLogVersion=-1;
    this.buildFloor();
  }
  buildFloor(){
    $("cells").innerHTML="";
    for(let y=0;y<8;y++)for(let x=0;x<10;x++){
      const node=NODES.find(n=>n.x===x&&n.y===y),button=document.createElement("button");
      button.className="cell"+(node?" node "+(node.resource==="copper_ore"?"copper":""):"");
      button.style.left=x*10+"%";button.style.top=y*12.5+"%";
      button.setAttribute("aria-label",`Tile (${x}, ${y})${node?", "+RESOURCES[node.resource].name+" deposit":", empty floor"}`);
      button.title=`(${x}, ${y})${node?" · "+RESOURCES[node.resource].name+" deposit":""}`;
      if(node)button.innerHTML=`<span class="ore-patch" aria-hidden="true">${"<i></i>".repeat(9)}</span>`;
      button.onclick=()=>this.ui.tile(x,y);$("cells").append(button);
    }
  }
  highlight(event){
    const ids=new Set([event.args.machineId,event.args.conveyorId,event.result.machineId,event.result.conveyorId,...(event.args.machineIds||[])]);
    for(const b of event.result.builds||[])ids.add(b.machineId);
    for(const id of ids)if(id)this.highlightIds.set(id,performance.now()+950);
    $("gearStat").classList.remove("flash");void $("gearStat").offsetWidth;$("gearStat").classList.add("flash");
  }
  render(){
    const e=this.engine,s=e.s;e.refreshMetrics();
    const bottlenecks=BottleneckAnalyzer.analyze(e),warningIds=new Set(bottlenecks.map(b=>b.machineId||b.conveyorId));
    for(const [id,element] of this.machineElements)if(!s.machines.some(m=>m.id===id)){element.remove();this.machineElements.delete(id)}
    for(const m of s.machines){
      let element=this.machineElements.get(m.id);
      if(!element){
        element=document.createElement("button");
        element.innerHTML=`<span class="status-dot"></span><span class="machine-level"></span><svg class="machine-art" viewBox="0 0 80 80" aria-hidden="true">${ART[m.type]}</svg><span class="machine-name"></span><span class="machine-alert"></span><span class="machine-progress"><i></i></span>`;
        element.onclick=()=>this.ui.machine(m.id);
        $("machines").append(element);this.machineElements.set(m.id,element);
      }
      element.className=`machine ${m.type} ${m.status}${this.ui.selected===m.id?" selected":""}${warningIds.has(m.id)?" warning":""}${(this.highlightIds.get(m.id)||0)>performance.now()?" highlight":""}`;
      element.style.left=(m.x*10+.4)+"%";element.style.top=(m.y*12.5+.4)+"%";
      element.querySelector(".machine-level").textContent="L"+m.level;
      element.querySelector(".machine-name").textContent=m.type+" "+m.id.split("-").at(-1);
      element.querySelector(".machine-alert").textContent=["STARVED","BLOCKED"].includes(m.status)?"⚠":"";
      const cycle=m.recipe&&RECIPES[m.recipe]?ProductionEngine.cycleTime(e,m,RECIPES[m.recipe]):null;
      element.querySelector(".machine-progress i").style.width=(cycle?Math.min(100,m.progress/cycle*100):0)+"%";
      element.setAttribute("aria-label",`${m.id}, ${m.status}, level ${m.level}, tile (${m.x}, ${m.y})`);
      element.title=`${m.id} · ${m.status}\n${m.recipe||"No recipe"} · ${round(e.nominal(m))}/min capacity\n(${m.x}, ${m.y})`;
      element.style.setProperty("animation-play-state",s.speed?"running":"paused");
      element.querySelectorAll(".rotor,.hot").forEach(el=>el.style.animationPlayState=s.speed?"running":"paused");
    }
    this.renderBelts(warningIds);
    this.renderMetrics();
    this.renderInspector();
    $("signals").innerHTML=bottlenecks.slice(0,5).map(b=>`<li class="signal">${esc(b.message)}<small>${esc(b.type.replaceAll("_"," "))} · ${b.observedRate} / ${b.requiredRate}${b.type==="OUTPUT_BLOCKED"?"":" per min"}</small></li>`).join("")||`<li style="color:var(--green);font-size:12px">✓ No active bottlenecks detected.</li>`;
    $("signalCount").textContent=bottlenecks.length+" signals";
    $("credits").textContent=s.credits.toLocaleString();
    $("simClock").textContent=`10 × 8 · ${Math.floor(s.time/60)}:${String(Math.floor(s.time%60)).padStart(2,"0")} simulated · ${s.speed?s.speed+"× RUNNING":"PAUSED"}`;
    $("pauseButton").textContent=s.speed?"Ⅱ Pause":"▶ Play";
    $("pauseButton").setAttribute("aria-label",s.speed?"Pause simulation":"Play simulation");
    document.querySelectorAll(".speed").forEach(b=>{b.classList.toggle("active",Number(b.dataset.speed)===s.speed);b.setAttribute("aria-pressed",String(Number(b.dataset.speed)===s.speed))});
    $("undoButton").disabled=!e.undo.stack.length;
    this.renderGraph();this.renderActivity();
  }
  renderBelts(warnings){
    const s=this.engine.s;
    const signature=s.conveyors.map(c=>`${c.id}:${c.level}:${this.ui.selected===c.id}:${warnings.has(c.id)}:${(this.highlightIds.get(c.id)||0)>performance.now()}:${s.speed>0}`).join("|");
    if(signature!==this.lastConveyorSignature){
      this.lastConveyorSignature=signature;
      $("belts").innerHTML=s.conveyors.map(c=>{
        const d=c.path.map((p,i)=>(i?"L":"M")+(p.x*100+50)+" "+(p.y*100+50)).join(" ");
        const mid=c.path[Math.floor(c.path.length/2)];
        return `<g data-id="${c.id}" class="${(this.highlightIds.get(c.id)||0)>performance.now()?"highlight":""}">
          ${this.ui.selected===c.id?`<path d="${d}" class="belt-selected"/>`:warnings.has(c.id)?`<path d="${d}" class="belt-warn"/>`:""}
          <path d="${d}" class="belt-bed"/><path d="${d}" class="belt-rail"/><path d="${d}" class="belt-tread ${s.speed?"belt-running":""}"/>
          <g class="cargo"></g><text x="${mid.x*100+50}" y="${mid.y*100+29}" text-anchor="middle" class="belt-label">${c.capacity}/m${warnings.has(c.id)?" ⚠":""}</text>
          <path d="${d}" class="belt-hit" tabindex="0" role="button" aria-label="${c.id}, capacity ${c.capacity} items per minute"><title>${c.id} · Click to inspect</title></path></g>`;
      }).join("");
      $("belts").querySelectorAll("[data-id]").forEach(g=>{
        const hit=g.querySelector(".belt-hit");
        hit.onclick=()=>this.ui.belt(g.dataset.id);
        hit.onkeydown=event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();this.ui.belt(g.dataset.id)}};
      });
    }
    for(const c of s.conveyors){
      const cargo=$("belts").querySelector(`[data-id="${c.id}"] .cargo`);if(!cargo)continue;
      cargo.innerHTML=c.items.map(item=>{
        const distance=Math.max(0,Math.min(c.path.length-1,(1-item.remaining/item.duration)*(c.path.length-1)));
        const i=Math.min(c.path.length-2,Math.floor(distance)),f=distance-i,a=c.path[i],b=c.path[i+1];
        const x=(a.x+(b.x-a.x)*f)*100+50,y=(a.y+(b.y-a.y)*f)*100+50;
        const r=RESOURCES[item.resource];
        return `<g transform="translate(${x} ${y})"><rect x="-9" y="-9" width="18" height="18" rx="3" fill="#111d23" stroke="${r.color}" stroke-width="1.5"/><text text-anchor="middle" y="5" font-size="14" fill="${r.color}">${r.symbol}</text></g>`;
      }).join("");
    }
  }
  renderMetrics(){
    const e=this.engine,t=e.throughput(),m=e.mission(),level=e.level(),c=e.constraints();
    const productRate=t[level.product+"_per_min"]??m.current;
    if($("gearRate"))$("gearRate").textContent=t.gear_per_min.toFixed(1);
    if($("plateRate"))$("plateRate").textContent=t.iron_plate_per_min.toFixed(1);
    if($("oreRate"))$("oreRate").textContent=t.iron_ore_per_min.toFixed(1);
    const fourthKey=level.product==="robot"?"robot":level.product==="motor"?"motor":level.product==="wire"?"wire":"circuit";
    if($("circuitRate"))$("circuitRate").textContent=(t[fourthKey+"_per_min"]||0).toFixed(1);
    if($("statCircuitLabel"))$("statCircuitLabel").textContent=
      fourthKey==="robot"?"▦ Robots / min":fourthKey==="motor"?"◎ Motors / min":fourthKey==="wire"?"⌁ Wire / min":"▦ Circuits / min";
    if($("missionBlurb"))$("missionBlurb").innerHTML=`${esc(level.blurb)} Target: <strong>${level.target} ${esc(productLabel(level.product))}/min</strong> for ${level.sustain}s.`;
    if($("missionTarget"))$("missionTarget").innerHTML=`${level.target}<span class="unit"> / min</span>`;
    $("missionCurrent").textContent=m.current.toFixed(1);
    $("missionBar").style.width=Math.min(100,m.current/level.target*100)+"%";
    $("missionProgress").setAttribute("aria-valuemax",String(level.target));
    $("missionProgress").setAttribute("aria-valuenow",String(Math.min(level.target,m.current)));
    $("sustain").textContent=`Hold target: ${m.sustainedSeconds.toFixed(1)} / ${level.sustain}s`;
    $("missionTitle").textContent=m.complete?"FLOOR CLEARED":`${level.id} · ${level.title}`.toUpperCase();
    $("missionBadge").textContent=m.complete?"MISSION COMPLETE":"IN PROGRESS";
    const checks=[
      [e.s.speed>0,"Factory running"],
      [this.ui.diagnosed,"Identify bottleneck"],
      [level.product==="gear"||level.product==="wire"?t.iron_plate_per_min+t.copper_plate_per_min>6:t.iron_plate_per_min>4,"Improve plate supply"],
      [productRate>level.target*0.4,`Raise ${productLabel(level.product)} throughput`],
      [m.complete,`Sustain ${level.target} ${productLabel(level.product)}/min`]
    ];
    $("checklist").innerHTML=checks.map(([done,label])=>`<li class="${done?"done":""}">${done?"☑":"☐"} ${label}</li>`).join("");
    $("graphDelta").textContent=`${productRate.toFixed(1)} / min · target ${level.target}`;
    if($("powerMeter")){
      if(level.powerBudget==null){$("powerMeter").hidden=true}
      else{
        $("powerMeter").hidden=false;
        const pct=Math.min(100,c.powerUsed/level.powerBudget*100);
        $("powerBar").style.width=pct+"%";
        $("powerBar").classList.toggle("over",c.powerUsed>level.powerBudget);
        $("powerText").textContent=`${c.powerUsed} / ${level.powerBudget} · peak ${c.powerPeak}`;
      }
    }
    if($("machineCap")){
      $("machineCap").textContent=level.maxMachines==null?`${c.machineCount} machines`:`${c.machineCount} / ${level.maxMachines} machines`;
    }
    if($("starsDisplay")){
      if(e.isDaily()){
        const entry=e.progress.daily?.byDate?.[level.dateKey];
        const stars=entry?.stars||0;
        $("starsDisplay").textContent=`${"★".repeat(stars)}${"☆".repeat(3-stars)} · streak ${e.progress.daily?.streak||0}`;
        $("pbDisplay").textContent=entry?.bestTime!=null?`Daily PB ${Number(entry.bestTime).toFixed(1)}s · ${entry.bestRate??"—"}/min`:"No daily clear yet";
      }else{
        const clear=e.progress.clears[level.id];
        const stars=clear?.stars||0;
        $("starsDisplay").textContent=`${"★".repeat(stars)}${"☆".repeat(3-stars)} · ${totalStars(e.progress)} total`;
        $("pbDisplay").textContent=clear?.bestTime!=null?`PB ${clear.bestTime.toFixed?.(1)??clear.bestTime}s · best ${clear.bestRate??"—"}/min`:"No clear yet";
      }
    }
    if($("researchList")){
      $("researchList").innerHTML=RESEARCH.map(node=>{
        const on=hasResearch(e.progress,node.id);
        return `<li class="${on?"done":""}">${on?"☑":"☐"} <strong>${esc(node.name)}</strong> — ${esc(node.description)}</li>`;
      }).join("");
    }
    if($("dailyDate"))$("dailyDate").textContent=e.isDaily()?(level.dateKey||taipeiDateKey()):taipeiDateKey();
    if($("dailyStreak"))$("dailyStreak").textContent=String(e.progress.daily?.streak||0);
    if($("dailyKit")){
      const kit=level.allowedMachines||unlockedMachineTypes(e.progress);
      $("dailyKit").textContent=e.isDaily()?`Kit: ${kit.join(", ")} · P${level.powerBudget??"∞"} · M${level.maxMachines??"∞"}`:"Campaign research tree";
    }
    if($("shareText")){
      $("shareText").value=formatDailyShareText(e.progress,e.isDaily()?level:dailyBlueprint());
    }
    if($("dailyButton")){
      $("dailyButton").textContent=e.isDaily()?"Leave Daily":"Daily Blueprint";
      $("dailyButton").setAttribute("aria-pressed",String(e.isDaily()));
      $("dailyButton").classList.toggle("active",e.isDaily());
    }
    if($("levelSelect")){
      const sel=$("levelSelect");
      sel.disabled=e.isDaily();
      if(sel.dataset.bound!=="1"){
        sel.innerHTML=LEVELS.map(l=>{
          const unlocked=isLevelUnlocked(e.progress,l.id);
          const stars=e.progress.clears[l.id]?.stars||0;
          return `<option value="${l.id}" ${unlocked?"":"disabled"}>${l.id} ${l.title}${stars?` (${"★".repeat(stars)})`:unlocked?"":" 🔒"}</option>`;
        }).join("");
        sel.dataset.bound="1";
        sel.onchange=()=>{
          playSelect();
          this.ui.call("factory_select_level",{levelId:sel.value});
          sel.dataset.bound="0";
          this.ui.refreshToolbar();
        };
      }
      if(!e.isDaily()&&sel.value!==level.id)sel.value=level.id;
    }
    if($("floorLabel"))$("floorLabel").textContent=e.isDaily()?`/ Daily ${level.dateKey||""}`:`/ ${level.id}`;
    if($("graphTitle"))$("graphTitle").textContent=`${RESOURCES[level.product]?.name||level.product} throughput`;
  }
  bufferHTML(buffer){return Object.entries(buffer).filter(([,n])=>n>0).map(([r,n])=>`${RESOURCES[r].symbol} ${n} ${esc(RESOURCES[r].name)}`).join("<br>")||'<span class="muted">Empty</span>'}
  renderInspector(){
    const e=this.engine,id=this.ui.selected;
    if(!id){$("inspector").innerHTML='<div class="inspector-empty">Select a machine or conveyor.<br>Inspect actual buffers and capacity before upgrading.</div>';return}
    const m=e.s.machines.find(m=>m.id===id),c=e.s.conveyors.find(c=>c.id===id);
    if(!m&&!c){this.ui.selected=null;this.renderInspector();return}
    const active=document.activeElement;
    if(active&&$("inspector").contains(active)&&active.tagName==="SELECT")return;
    if(m){
      const a=e.inspectMachine(id);
      $("inspectorType").textContent=m.type.toUpperCase();
      const unlockedRecipesSet=new Set(unlockedRecipes(this.engine.progress));
      const compatible=Object.entries(RECIPES).filter(([id,r])=>r.machine===m.type&&(r.machine==="miner"||r.machine==="smelter"||id==="gear"||unlockedRecipesSet.has(id)));
      const max=a.maxMachineLevel;
      $("inspector").innerHTML=`
        <div class="inspector-title"><strong class="mono" style="font-size:12px">${m.id.toUpperCase()}</strong><span class="badge ${m.status==="WORKING"?"good":"warn"}">${m.status}</span></div>
        <div class="kv"><span>Position / level</span><span>(${m.x}, ${m.y}) · Level ${m.level}/${max}</span><span>Actual / capacity</span><span>${round(m.productionRate)} / ${a.nominalCapacityPerMin} per min</span><span>Efficiency / cycle</span><span>${Math.round(m.efficiency*100)}% · ${a.cycleTime??"—"}s</span><span>Input / output flow</span><span>${a.inputRate} / ${a.outputRate} per min</span><span>Buffer capacity</span><span>${m.capacity} items each</span><span>Power draw</span><span>${powerDraw(m.type,e.progress)}${m.online?"":" (offline)"}</span></div>
        ${compatible.length?`<div class="recipe-row"><label for="recipeSelect">Recipe</label><select id="recipeSelect"><option value="">Not configured</option>${compatible.map(([id])=>`<option value="${id}" ${m.recipe===id?"selected":""}>${RESOURCES[id].name}</option>`).join("")}</select></div>`:""}
        <div class="buffer"><div><label>${isRelay(m)?"Contents":"Input buffer"}</label>${this.bufferHTML(m.inputBuffer)}</div><div><label>${isRelay(m)?"Capacity used":"Output buffer"}</label>${isRelay(m)?sum(m.inputBuffer)+" / "+m.capacity:this.bufferHTML(m.outputBuffer)}</div></div>
        <div class="kv"><span>Connected inputs</span><span>${a.connectedInputs.map(c=>esc(c.machineId)+" · "+esc(c.conveyorId)).join("<br>")||"None"}</span><span>Connected outputs</span><span>${a.connectedOutputs.map(c=>esc(c.machineId)+" · "+esc(c.conveyorId)).join("<br>")||"None"}</span></div>
        <div class="inspector-actions"><button id="inspectUpgrade" ${m.level>=max?"disabled":""}>↑ ${m.level>=max?"Max level":"Upgrade · "+a.upgradeCost}</button><button id="inspectPower">${m.online?"⏻ Stop":"▶ Start"}</button><button id="inspectDelete" title="Delete machine and incident belts">Delete</button></div>`;
      if($("recipeSelect"))$("recipeSelect").onchange=event=>{
        if(event.target.value)this.ui.call("machine_set_recipe",{machineId:id,recipe:event.target.value});
        else this.ui.toast("Choose a valid recipe.",true);
      };
      $("inspectUpgrade").onclick=()=>this.ui.call("machine_upgrade",{machineId:id});
      $("inspectPower").onclick=()=>this.ui.call("machine_set_power",{machineId:id,enabled:!m.online});
      $("inspectDelete").onclick=()=>this.ui.call("machine_delete",{machineId:id});
    }else{
      const a=e.inspectConveyor(id);$("inspectorType").textContent="CONVEYOR";
      $("inspector").innerHTML=`
        <div class="inspector-title"><strong class="mono" style="font-size:12px">${id.toUpperCase()}</strong><span class="badge">LEVEL ${c.level}</span></div>
        <div class="kv"><span>Source</span><span>${c.fromMachineId}</span><span>Destination</span><span>${c.toMachineId}</span><span>Capacity</span><span>${c.capacity} items/min</span><span>Actual flow</span><span>${round(c.throughput)} items/min</span><span>Utilization</span><span>${Math.round(c.utilization*100)}%</span><span>Resource</span><span>${RESOURCES[c.transportedResource]?.name||"No items yet"}</span><span>Items in transit</span><span>${c.items.length}</span><span>Travel time</span><span>${round(a.travelTimeSeconds)}s</span><span>Orthogonal route</span><span>${c.path.length-1} adjacent steps</span></div>
        <div class="progress"><i style="width:${c.utilization*100}%"></i></div>
        <div class="inspector-actions"><button id="beltUpgrade" ${c.level>=3?"disabled":""}>↑ ${c.level>=3?"Max level":"Upgrade · "+a.upgradeCost}</button><button id="beltDisconnect">Disconnect</button></div>`;
      $("beltUpgrade").onclick=()=>this.ui.call("conveyor_upgrade",{conveyorId:id});
      $("beltDisconnect").onclick=()=>this.ui.call("conveyor_disconnect",{conveyorId:id});
    }
  }
  renderGraph(){
    const s=this.engine.s,level=this.engine.level(),target=level.target,data=s.history,max=Math.max(16,target+2,...data.map(p=>p.value+2));
    const x=t=>30+(t-(s.time-60))/60*288,y=v=>130-v/max*112;
    const points=data.map(p=>`${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const marks=[0,Math.round(target/2),target,Math.round(target*1.5)].filter((v,i,a)=>a.indexOf(v)===i);
    $("graph").innerHTML=`
      <defs><linearGradient id="graphFill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#5ed7e8" stop-opacity=".28"/><stop offset="1" stop-color="#5ed7e8" stop-opacity="0"/></linearGradient></defs>
      ${marks.map(v=>`<line x1="30" x2="320" y1="${y(v)}" y2="${y(v)}" stroke="#304151" stroke-width=".6"/><text x="21" y="${y(v)+3}" text-anchor="end" class="graph-label">${v}</text>`).join("")}
      <line x1="30" x2="320" y1="${y(target)}" y2="${y(target)}" stroke="#82e2ab" stroke-dasharray="4 4" opacity=".7"/><text x="316" y="${y(target)-5}" text-anchor="end" class="graph-label" style="fill:#82e2ab">TARGET ${target}</text>
      ${data.length?`<polygon points="${x(data[0].t)},130 ${points} ${x(data.at(-1).t)},130" fill="url(#graphFill)"/><polyline points="${points}" fill="none" stroke="#5ed7e8" stroke-width="2.3" stroke-linejoin="round"/><circle cx="${x(data.at(-1).t)}" cy="${y(data.at(-1).value)}" r="3" fill="#9fecf4"/>`:""}
      <text x="30" y="149" class="graph-label">${esc(productLabel(level.product))} / min · 60s rolling</text>`;
  }
  renderActivity(){
    const logger=this.engine.logger;if(!logger||logger.version===this.lastLogVersion)return;
    this.lastLogVersion=logger.version;
    const box=$("activity"),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<50;
    box.innerHTML=logger.entries.map(v=>`<div class="log-row"><span class="log-time">${esc(v.time)}</span><span class="source-${v.source}">${v.source}</span><span class="log-message">${esc(v.message)}</span></div>`).join("");
    if(nearBottom)box.scrollTop=box.scrollHeight;
    if(logger.trail.length)$("trail").innerHTML=logger.trail.map(t=>`<span class="trail-chip">${esc(t)}</span>`).join("");
  }
}

/* GRID INTERACTION, BUILD TOOLBAR, INSPECTOR AND SHARED UI ACTIONS */
class UIController {
  constructor(engine){
    this.engine=engine;this.selected=null;this.tool="inspect";this.connectSource=null;this.diagnosed=false;this.toastTimer=null;this.renderer=null;
    this.initializeControls();
  }
  toast(message,error=false){
    $("toast").textContent=message;$("toast").className="show"+(error?" error":"");
    clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$("toast").className="",4000);
  }
  call(name,args={}){
    const result=this.engine.invoke(name,args,"UI");
    if(!result.success){playError();this.toast(result.error,true)}
    else if(!TOOLS.find(t=>t.name===name)?.readOnly){
      if(name==="machine_build")playBuild();
      else if(name==="conveyor_connect"||name==="factory_undo")playMove();
      else if(name==="factory_select_level"||name==="factory_enter_daily"||name==="factory_exit_daily")playSelect();
      this.toast(result.message||`${name.replaceAll("_"," ")} ✓${result.cost!==undefined?" · "+result.cost+" credits":""}`);
    }
    return result;
  }
  setTool(tool){
    this.tool=tool;this.connectSource=null;
    document.querySelectorAll(".tool-button").forEach(b=>{b.classList.toggle("active",b.dataset.tool===tool);b.setAttribute("aria-pressed",String(b.dataset.tool===tool))});
    const hints={
      inspect:"Inspect a machine or conveyor. All buffers, capacities and production rates are live.",
      conveyor:"Connect conveyor: select the source machine, then the destination. Recipes must be compatible. Routes are orthogonal.",
      delete:"Delete tool: select a machine or conveyor. Base construction cost is 50% refunded. Undo restores configuration."
    };
    $("hint").textContent=hints[tool]||`Build ${DEFINITIONS[tool].name} · ${DEFINITIONS[tool].cost} credits · power ${powerDraw(tool,this.engine.progress)}. Click an empty tile${tool==="miner"?" on a visible resource deposit":""}.`;
  }
  refreshToolbar(){
    const unlocked=this.engine.allowedMachineSet();
    const tools=[["inspect","⌖","Inspect","select"],...Object.entries(DEFINITIONS).filter(([id])=>unlocked.has(id)).map(([id,d])=>[id,d.icon,d.name,d.cost+" cr"]),["conveyor","⇢","Conveyor","15 / tile"],["delete","⌫","Delete","50% refund"]];
    $("toolbar").innerHTML=tools.map(([id,icon,name,cost])=>`<button class="tool-button ${id===this.tool?"active":""}" data-tool="${id}" aria-label="${name}, ${cost}" aria-pressed="${id===this.tool}" style="touch-action:manipulation"><span class="glyph" aria-hidden="true">${icon}</span>${name}<small>${cost}</small></button>`).join("");
    document.querySelectorAll(".tool-button").forEach(b=>b.onclick=()=>this.setTool(b.dataset.tool));
    if(!tools.some(([id])=>id===this.tool))this.setTool("inspect");
  }
  tile(x,y){
    if(DEFINITIONS[this.tool]){
      const r=this.call("machine_build",{type:this.tool,x,y});
      if(r.success){this.selected=r.machineId;this.renderer.render()}
    }else if(this.tool==="inspect"){this.selected=null;this.renderer.render()}
    else this.toast("Select a machine"+(this.tool==="delete"?" or conveyor.":"."));
  }
  machine(id){
    if(this.tool==="delete"){this.call("machine_delete",{machineId:id});this.renderer.render();return}
    if(this.tool==="conveyor"){
      if(!this.connectSource){this.connectSource=id;this.selected=id;$("hint").textContent=`Source: ${id}. Now select a compatible destination machine.`}
      else{
        const r=this.call("conveyor_connect",{fromMachineId:this.connectSource,toMachineId:id});
        if(r.success){this.selected=r.conveyorId;this.connectSource=null;$("hint").textContent="Conveyor connected. Select another source, or switch to Inspect."}
      }
    }else{
      this.selected=id;this.diagnosed=true;
      this.call("machine_inspect",{machineId:id});
    }
    this.renderer.render();
  }
  belt(id){
    if(this.tool==="delete")this.call("conveyor_disconnect",{conveyorId:id});
    else{this.selected=id;this.diagnosed=true;this.call("conveyor_inspect",{conveyorId:id});this.renderer.render()}
  }
  initializeControls(){
    this.refreshToolbar();
    $("pauseButton").onclick=()=>this.call("simulation_set_speed",{speed:this.engine.s.speed?0:1});
    document.querySelectorAll(".speed").forEach(b=>b.onclick=()=>this.call("simulation_set_speed",{speed:Number(b.dataset.speed)}));
    $("undoButton").onclick=()=>this.call("factory_undo");
    $("resetButton").onclick=()=>{if(confirm("Restore this level's starter factory? Your current layout and undo history will be replaced.")){this.selected=null;this.diagnosed=false;this.connectSource=null;this.call("factory_reset")}};
    if($("dailyButton")){
      $("dailyButton").onclick=()=>{
        playSelect();
        if(this.engine.isDaily())this.call("factory_exit_daily");
        else this.call("factory_enter_daily");
        this.refreshToolbar();
        if($("levelSelect"))$("levelSelect").dataset.bound="0";
        this.renderer?.render();
      };
    }
    if($("shareCopy")){
      $("shareCopy").onclick=async()=>{
        const text=$("shareText")?.value||formatDailyShareText(this.engine.progress,dailyBlueprint());
        try{
          await navigator.clipboard.writeText(text);
          this.toast("Daily share text copied.");
        }catch{
          if($("shareText")){$("shareText").focus();$("shareText").select()}
          this.toast("Clipboard unavailable — select and copy the share text.",true);
        }
      };
    }
    const prompts=[
      "Increase gear production to at least 10 gears per minute.",
      "Why is gear production so slow?",
      "Find the biggest bottleneck in the factory.",
      "Fix the assembler’s material shortage.",
      "Which machine should I upgrade first?",
      "Increase production using less than 400 credits.",
      "Build a second smelting line.",
      "Double gear production without deleting anything.",
      "Optimize the factory while spending as little as possible.",
      "Are any conveyors operating at full capacity?",
      "Which machines are currently idle or starved?",
      "Can this factory reach 10 gears/min with the credits we have?",
      "List campaign levels and my research unlocks.",
      "What is my power budget and current draw?",
      "Load today's daily blueprint and summarize the constraints.",
      "What research unlocks wire and motor recipes?"
    ];
    for(const text of prompts){
      const b=document.createElement("button");b.className="prompt";b.textContent="“"+text+"”";b.style.touchAction="manipulation";
      b.onclick=async()=>{
        try{await navigator.clipboard.writeText(text);this.toast("Prompt copied. Paste it into your WebMCP-capable agent.")}
        catch{this.toast("Clipboard unavailable. The prompt is selected for copying.");const range=document.createRange();range.selectNodeContents(b);const selection=getSelection();selection.removeAllRanges();selection.addRange(range)}
      };$("prompts").append(b);
    }
    $("consoleTool").innerHTML=TOOLS.map(t=>`<option value="${t.name}">${t.name} · ${t.readOnly?"READ":"WRITE"}</option>`).join("");
    $("consoleTool").onchange=()=>{
      const t=TOOLS.find(t=>t.name===$("consoleTool").value),example={};
      for(const [key,schema] of Object.entries(t.inputSchema.properties)){
        example[key]=key==="machineId"?"smelter-1":key==="fromMachineId"?"miner-1":key==="toMachineId"?"smelter-1":key==="conveyorId"?"conveyor-2":key==="levelId"?"L01":key==="recipe"?"iron_plate":key==="x"?5:key==="y"?3:key==="speed"?2:key==="enabled"?true:key==="machines"?[{type:"smelter",x:5,y:3}]:key==="machineIds"?["smelter-1"]:schema.enum?.[0]??"";
      }
      $("consoleInput").value=JSON.stringify(example,null,2);
      $("consoleOutput").textContent=t.description+"\n\n"+JSON.stringify(t.inputSchema,null,2);
    };
    $("consoleRun").onclick=()=>{
      try{$("consoleOutput").textContent=JSON.stringify(this.call($("consoleTool").value,JSON.parse($("consoleInput").value)),null,2)}
      catch(error){$("consoleOutput").textContent=JSON.stringify({success:false,error:"Invalid JSON: "+error.message},null,2);this.toast("Invalid JSON arguments.",true)}
    };
  }
}

/* WEBMCP ADAPTER: no DOM interaction, no separate simulation state. */
class WebMCPAdapter {
  constructor(engine,ui){this.engine=engine;this.ui=ui;this.registered=new Set();this.registering=false}
  async register(){
    if(this.registering)return;this.registering=true;
    try{
      if(!("modelContext" in document)||!document.modelContext||typeof document.modelContext.registerTool!=="function"){
        $("mcpStatus").className="badge warn";
        $("mcpStatus").innerHTML='<span class="dot"></span>WebMCP Unsupported';
        this.engine.logger.add("System","WebMCP unsupported. Human controls and shared capability console are fully available.");
        return;
      }
      for(const tool of TOOLS){
        if(this.registered.has(tool.name))continue;
        await document.modelContext.registerTool({
          name:tool.name,description:tool.description,inputSchema:clone(tool.inputSchema),annotations:clone(tool.annotations),
          execute:async(args={})=>{
            const result=this.engine.invoke(tool.name,args,"WebMCP");
            return {content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result,isError:!result.success};
          }
        });
        this.registered.add(tool.name);
      }
      $("mcpStatus").className="badge good";
      $("mcpStatus").innerHTML='<span class="dot"></span>WebMCP Connected';
      this.engine.logger.add("System",`${this.registered.size} structured factory tools registered with document.modelContext.`);
    }catch(error){
      $("mcpStatus").className="badge warn";
      $("mcpStatus").innerHTML='<span class="dot"></span>WebMCP registration error';
      this.engine.logger.add("System","WebMCP registration: "+error.message+". Human controls remain available.");
    }finally{this.registering=false;this.showTools()}
  }
  async showTools(refresh=false){
    let remoteNames=null;
    if(refresh&&"modelContext" in document&&typeof document.modelContext?.getTools==="function"){
      try{
        const response=await document.modelContext.getTools();
        const list=Array.isArray(response)?response:response?.tools;
        if(Array.isArray(list))remoteNames=new Set(list.map(t=>t.name));
      }catch(error){this.engine.logger.add("System","Tool discovery unavailable; displaying local tool definitions.")}
    }
    $("toolsList").innerHTML=TOOLS.map(t=>`<div class="tool-entry" title="${esc(t.description)}"><div class="tool-entry-head"><span>${t.name}</span><span class="${t.readOnly?"read-tag":"write-tag"}">${t.readOnly?"READ":"WRITE"}</span></div><div class="tool-description">${esc(t.description.split(". ")[0])}.${remoteNames?remoteNames.has(t.name)?" · Browser registered":" · Local definition":""}</div></div>`).join("");
    if(refresh)this.ui.toast(`${TOOLS.length} local capabilities${remoteNames?" · browser discovery refreshed":""}.`);
  }
}

/* NON-DESTRUCTIVE SELF TESTS: isolated engines only. */
function runSelfTests(){
  let passed=0,failed=0;
  const test=(name,fn)=>{
    try{fn();passed++}
    catch(error){failed++;console.error("[Mini Factory self-test] "+name,error)}
  };
  const check=(v,msg)=>{if(!v)throw new Error(msg||"Assertion failed")};
  const fresh=()=>new FactoryEngine({warm:false});
  const run=(e,n,a={})=>e.invoke(n,a,"System");
  test("Machine build and credit deduction",()=>{
    const e=fresh(),r=run(e,"machine_build",{type:"smelter",x:5,y:3});
    check(r.success&&e.s.credits===820&&e.machine(r.machineId).type==="smelter");
  });
  test("Occupied tile rejection",()=>{
    const e=fresh(),r=run(e,"machine_build",{type:"smelter",x:4,y:2});
    check(!r.success&&e.s.credits===1000&&e.s.machines.length===4);
  });
  test("Machine delete and incident connections",()=>{
    const e=fresh();check(run(e,"machine_delete",{machineId:"smelter-1"}).success);
    check(e.s.machines.length===3&&e.s.conveyors.length===1&&e.s.credits===1090);
  });
  test("Recipe compatibility",()=>{
    const e=fresh();check(!run(e,"machine_set_recipe",{machineId:"smelter-1",recipe:"gear"}).success);
    check(e.machine("smelter-1").recipe==="iron_plate");
  });
  test("Machine upgrade",()=>{
    const e=fresh();check(run(e,"machine_upgrade",{machineId:"smelter-1"}).success);
    check(e.machine("smelter-1").level===2&&e.s.credits===850);
  });
  test("Conveyor connection",()=>{
    const e=fresh(),b=run(e,"machine_build",{type:"smelter",x:5,y:3});
    run(e,"machine_set_recipe",{machineId:b.machineId,recipe:"iron_plate"});
    const r=run(e,"conveyor_connect",{fromMachineId:"miner-1",toMachineId:b.machineId});
    check(r.success&&r.path.every((p,i)=>!i||Math.abs(p.x-r.path[i-1].x)+Math.abs(p.y-r.path[i-1].y)===1));
  });
  test("Resource transfer",()=>{
    const e=fresh();e.machine("miner-1").outputBuffer.iron_ore=2;e.machine("miner-1").online=true;
    for(let i=0;i<24;i++)e.simulation.step();
    check(e.s.events.some(v=>v.kind==="flow"&&v.resource==="iron_ore"));
  });
  test("Production cycle",()=>{
    const e=fresh(),m=e.machine("smelter-1");m.inputBuffer.iron_ore=1;
    for(let i=0;i<20;i++){e.s.time+=.25;ProductionEngine.step(e,.25)}
    check((m.outputBuffer.iron_plate||0)===1);
  });
  test("Starvation detection",()=>{
    const e=fresh();ProductionEngine.step(e,.25);check(e.machine("assembler-1").status==="STARVED");
  });
  test("Blocked detection",()=>{
    const e=fresh(),m=e.machine("smelter-1");m.outputBuffer.iron_plate=12;m.inputBuffer.iron_ore=2;
    ProductionEngine.step(e,.25);check(m.status==="BLOCKED");
  });
  test("Bottleneck analysis",()=>{
    const e=fresh();check(BottleneckAnalyzer.analyze(e).some(b=>b.type==="CONVEYOR_CAPACITY"&&b.conveyorId==="conveyor-2"));
  });
  test("Rolling throughput calculation",()=>{
    const e=fresh();e.s.time=100;e.s.events=[{t:99,kind:"produced",resource:"gear",n:4},{t:20,kind:"produced",resource:"gear",n:100}];
    check(e.throughput().gear_per_min===4);
  });
  test("Batch build atomicity",()=>{
    const e=fresh(),r=run(e,"factory_batch_build",{machines:[{type:"smelter",x:5,y:3},{type:"smelter",x:4,y:2}]});
    check(!r.success&&e.s.credits===1000&&e.s.machines.length===4);
  });
  test("Batch upgrade atomicity",()=>{
    const e=fresh();e.s.credits=200;
    check(!run(e,"factory_batch_upgrade",{machineIds:["smelter-1","assembler-1"]}).success);
    check(e.s.credits===200&&e.machine("smelter-1").level===1);
  });
  test("Undo does not rewind simulation",()=>{
    const e=fresh();run(e,"machine_upgrade",{machineId:"smelter-1"});e.simulation.step();
    const t=e.s.time;run(e,"factory_undo");
    check(e.machine("smelter-1").level===1&&e.s.credits===1000&&e.s.time===t);
  });
  test("Reset",()=>{
    const e=fresh();run(e,"machine_delete",{machineId:"smelter-1"});run(e,"factory_reset");
    check(e.s.machines.length===4&&e.s.credits===1000&&e.s.time===180&&e.s.conveyors.length===3);
  });
  test("Saved configuration validation",()=>{
    const e=fresh();validateSavedConfiguration(e.configuration());
    const bad=e.configuration();bad.conveyors[0].path[1]={x:9,y:7};
    let rejected=false;try{validateSavedConfiguration(bad)}catch{rejected=true}check(rejected);
  });
  test("Mission is attainable through normal capabilities",()=>{
    const e=new FactoryEngine();
    check(run(e,"machine_upgrade",{machineId:"smelter-1"}).success);
    check(run(e,"machine_upgrade",{machineId:"smelter-1"}).success);
    check(run(e,"conveyor_upgrade",{conveyorId:"conveyor-2"}).success);
    check(run(e,"conveyor_upgrade",{conveyorId:"conveyor-2"}).success);
    for(let i=0;i<240/.25;i++)e.simulation.step();
    check(e.throughput().gear_per_min>=10&&e.mission().complete&&e.s.credits===440);
  });
  test("L01 classic starter bottleneck",()=>{
    const e=fresh();
    check(e.s.machines.length===4&&e.s.credits===1000);
    check(e.s.conveyors.find(c=>c.id==="conveyor-2").level===1);
    check(BottleneckAnalyzer.analyze(e).some(b=>b.conveyorId==="conveyor-2"));
  });
  test("Splitter locked without research",()=>{
    const e=fresh();
    check(!run(e,"machine_build",{type:"splitter",x:5,y:3}).success);
    e.progress.research.push("splitter");
    check(run(e,"machine_build",{type:"splitter",x:5,y:3}).success);
  });
  test("Power budget rejects overdraw",()=>{
    const e=fresh();
    e.s.levelId="L03";
    e.progress.currentLevelId="L03";
    const level=getLevel("L03");
    check(level.powerBudget===18);
    check(powerUsed(e.s.machines,MACHINE_POWER,e.progress)===13);
    check(canAffordPower(e.s.machines,"smelter",level.powerBudget,MACHINE_POWER,e.progress));
    check(!canAffordPower(e.s.machines,"robot_assembler",level.powerBudget,MACHINE_POWER,e.progress));
    const r=run(e,"machine_build",{type:"smelter",x:5,y:3});
    check(r.success);
    check(!run(e,"machine_build",{type:"assembler",x:6,y:3}).success);
  });
  test("Circuit recipe gated by research",()=>{
    const e=fresh();
    check(!run(e,"machine_set_recipe",{machineId:"assembler-1",recipe:"circuit"}).success);
    e.progress.research.push("circuits");
    run(e,"conveyor_disconnect",{conveyorId:"conveyor-2"});
    run(e,"conveyor_disconnect",{conveyorId:"conveyor-3"});
    check(run(e,"machine_set_recipe",{machineId:"assembler-1",recipe:"circuit"}).success);
  });
  test("Machine level 3 available without overclock; overclock discounts power",()=>{
    const e=fresh();
    check(e.maxLevel()===3);
    check(run(e,"machine_upgrade",{machineId:"smelter-1"}).success);
    check(run(e,"machine_upgrade",{machineId:"smelter-1"}).success);
    check(e.machine("smelter-1").level===3);
    check(!run(e,"machine_upgrade",{machineId:"smelter-1"}).success);
    const before=powerUsed(e.s.machines,MACHINE_POWER,e.progress);
    e.progress.research.push("overclock");
    check(powerDiscount(e.progress)===1);
    check(powerDraw("smelter",e.progress)===MACHINE_POWER.smelter-1);
    check(powerUsed(e.s.machines,MACHINE_POWER,e.progress)<before);
  });
  test("New campaign tools exist",()=>{
    const names=new Set(TOOLS.map(t=>t.name));
    for(const n of ["factory_list_levels","factory_get_progress","factory_select_level","factory_get_research","factory_get_constraints","factory_get_daily","factory_enter_daily","factory_exit_daily"])check(names.has(n));
    const e=fresh();
    check(run(e,"factory_list_levels").levels.length===LEVELS.length);
    check(run(e,"factory_get_constraints").powerBudget===null);
    check(run(e,"factory_get_research").research.length===RESEARCH.length);
  });
  test("Wire and motor recipes gated by research",()=>{
    const e=fresh();
    check(!run(e,"machine_set_recipe",{machineId:"assembler-1",recipe:"wire"}).success);
    check(!run(e,"machine_set_recipe",{machineId:"assembler-1",recipe:"motor"}).success);
    e.progress.research.push("wiring");
    run(e,"conveyor_disconnect",{conveyorId:"conveyor-2"});
    run(e,"conveyor_disconnect",{conveyorId:"conveyor-3"});
    check(run(e,"machine_set_recipe",{machineId:"assembler-1",recipe:"wire"}).success);
    e.progress.research.push("motors");
    check(run(e,"machine_set_recipe",{machineId:"assembler-1",recipe:"motor"}).success);
  });
  test("Bulk storage and deep mining bonuses",()=>{
    const e=fresh();
    const storage=e.machine("storage-1");
    const baseCap=storage.capacity;
    e.progress.research.push("bulk_storage");
    e.refreshMetrics();
    check(e.machine("storage-1").capacity===baseCap*2);
    const miner=e.machine("miner-1");
    const before=ProductionEngine.cycleTime(e,miner,RECIPES.iron_ore);
    e.progress.research.push("deep_mining");
    const after=ProductionEngine.cycleTime(e,miner,RECIPES.iron_ore);
    check(after<before);
  });
  test("Daily blueprint enter/exit and share text",()=>{
    const e=fresh();
    const daily=run(e,"factory_get_daily");
    check(daily.success&&/^\d{4}-\d{2}-\d{2}$/.test(daily.dateKey)&&daily.blueprint?.product);
    check(typeof daily.shareText==="string"&&daily.shareText.includes("每日藍圖"));
    check(run(e,"factory_enter_daily").success&&e.isDaily());
    check(e.level().id===DAILY_LEVEL_ID);
    check(e.level().powerBudget!=null||e.level().maxMachines!=null||e.level().target>0);
    check(run(e,"factory_exit_daily").success&&!e.isDaily());
    check(e.level().id==="L01");
  });
  console.info(`[Mini Factory self-tests] ${passed} passed, ${failed} failed. Tests used isolated engines; live factory untouched.`);
}

/* INITIALIZATION */
runSelfTests();

function bootFactoryApp(){
if(typeof document==="undefined"||typeof document.getElementById!=="function"||!document.getElementById("board"))return;
const logger=new ActivityLogger();
const factoryEngine=new FactoryEngine({logger:null,persistent:true,warm:true});
factoryEngine.logger=logger;
factoryEngine.load();
const ui=new UIController(factoryEngine);
const renderer=new FactoryRenderer(factoryEngine,ui);ui.renderer=renderer;
const resultOverlay=createResultOverlay(document.body);

function presentSettlement(settlement){
  if(!settlement)return;
  playWin();
  for(let i=0;i<settlement.stars;i++)setTimeout(()=>playStar(i+1),180+i*160);
  if(settlement.newlyResearch?.length){
    setTimeout(()=>playResearch(),700);
    for(const id of settlement.newlyResearch){
      const node=RESEARCH.find(r=>r.id===id);
      logger.add("System",`Research unlocked: ${node?.name||id}.`);
    }
  }
  const isDaily=Boolean(settlement.daily);
  const level=isDaily?factoryEngine.level():getLevel(settlement.levelId);
  const next=!isDaily&&settlement.nextLevelId&&isLevelUnlocked(factoryEngine.progress,settlement.nextLevelId)?settlement.nextLevelId:null;
  if(isDaily&&settlement.shareText&&$("shareText"))$("shareText").value=settlement.shareText;
  resultOverlay.show({
    variant:"win",
    badge:`${"★".repeat(settlement.stars)}${"☆".repeat(3-settlement.stars)}`,
    title:isDaily?`Daily ${settlement.dateKey||taipeiDateKey()} cleared`:`${level?.title||settlement.levelId} cleared`,
    subtitle:isDaily
      ?`Streak ${settlement.streak||1} day${(settlement.streak||1)===1?"":"s"}${settlement.isNewBest?" · New daily best!":""}`
      :(settlement.newlyResearch?.length?`Unlocked: ${settlement.newlyResearch.map(id=>RESEARCH.find(r=>r.id===id)?.name||id).join(", ")}`:(settlement.isNewBest?"New personal best!":"Floor complete.")),
    stats:[
      {label:"Product rate",value:`${settlement.attempt.rate.toFixed(1)} / min`},
      {label:"Machines",value:String(settlement.attempt.machineCount)},
      {label:"Power peak",value:String(settlement.attempt.powerPeak)},
      {label:isDaily?"Streak":"Credits left",value:isDaily?String(settlement.streak||1):String(settlement.attempt.creditsLeft)}
    ],
    primaryLabel:next?"Next level":(isDaily?"Copy share text":"Keep optimizing"),
    onPrimary:()=>{
      resultOverlay.hide();
      if(next){
        ui.call("factory_select_level",{levelId:next});
        ui.refreshToolbar();
        if($("levelSelect"))$("levelSelect").dataset.bound="0";
      }else if(isDaily&&settlement.shareText){
        navigator.clipboard?.writeText(settlement.shareText).then(()=>ui.toast("Daily share text copied.")).catch(()=>{
          if($("shareText")){$("shareText").focus();$("shareText").select()}
        });
      }
      renderer.render();
    },
    secondaryLabel:"Dismiss",
    onSecondary:()=>resultOverlay.hide()
  });
  if($("levelSelect"))$("levelSelect").dataset.bound="0";
  ui.refreshToolbar();
}

factoryEngine.onMissionComplete=()=>{
  const settlement=factoryEngine.settleClear();
  presentSettlement(settlement);
  renderer.render();
};
factoryEngine.onChange=event=>{
  if(event.result.success){
    if(["factory_get_bottlenecks","machine_inspect","conveyor_inspect"].includes(event.name))ui.diagnosed=true;
    if(event.source==="WebMCP"&&event.mutation)renderer.highlight(event);
    if(event.name==="factory_reset"||event.name==="factory_select_level"||event.name==="factory_enter_daily"||event.name==="factory_exit_daily"){
      ui.selected=null;ui.diagnosed=false;ui.connectSource=null;ui.refreshToolbar();
      if($("levelSelect"))$("levelSelect").dataset.bound="0";
    }
  }
  renderer.render();
};
factoryEngine.onTick=()=>renderer.render();
logger.onChange=()=>renderer.renderActivity();
logger.add("System","FactoryEngine ready. Human controls and WebMCP capabilities share the same state.");
const bootLevel=factoryEngine.level();
if(factoryEngine.s.time===180)logger.add("Factory",`Initial factory warmed up by deterministic simulation · ${factoryEngine.throughput()[bootLevel.product+"_per_min"].toFixed(1)} ${productLabel(bootLevel.product)}/min.`);
logger.add("System",`Mission (${bootLevel.id}): sustain ${bootLevel.target} ${productLabel(bootLevel.product)}/min for ${bootLevel.sustain}s.`);
const webMCPAdapter=new WebMCPAdapter(factoryEngine,ui);
$("refreshTools").onclick=async()=>{await webMCPAdapter.register();await webMCPAdapter.showTools(true)};
renderer.render();
webMCPAdapter.showTools();
webMCPAdapter.register();
factoryEngine.simulation.start();
window.factoryEngine=factoryEngine;
window.factoryTools=Object.fromEntries(TOOLS.map(t=>[t.name,(args={})=>factoryEngine.invoke(t.name,args,"UI")]));
window.addEventListener("beforeunload",()=>factoryEngine.save());
}

bootFactoryApp();

