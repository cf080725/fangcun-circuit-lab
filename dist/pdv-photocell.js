export const pdvPhotocellModel = 'pdv-p8103';
export const pdvPhotocellMaxLux = 100000;

const nominalAt10Lux = 24000;
const darkOhms = 500000;
const minimumOhms = 100;
const sensitivity = .75;
const riseMs = 60, fallMs = 25;
const logNine = Math.log(9);

function targetResistance(lux) {
  if(lux<=0)return darkOhms;
  return Math.max(minimumOhms,Math.min(darkOhms,nominalAt10Lux*(10/lux)**sensitivity));
}

export function advancePdvPhotocell(part,previous,elapsedMs) {
  const ambientLux=Number.isFinite(part.lux) ? Math.min(pdvPhotocellMaxLux,Math.max(0,part.lux)) : 100;
  const covered=part.ldrCovered===true,targetLux=covered?0:ambientLux;
  const targetOhms=targetResistance(targetLux),target=1/targetOhms;
  let conductance=previous?.conductance??target;
  if(previous && Number.isFinite(elapsedMs) && elapsedMs>0){
    // Use the previous illumination over the elapsed interval. The new
    // target starts now. Treat the published 60/25 ms as 10–90% response
    // spans in conductance for this teaching model.
    const delta=previous.target-conductance;
    const span=delta>0?riseMs:fallMs;
    conductance+=delta*(-Math.expm1(-logNine*elapsedMs/span));
  }
  return {
    state:{conductance,target},
    reading:{ambientLux,targetLux,covered,resistance:1/conductance,targetResistance:targetOhms,
      settling:Math.abs(conductance-target)>target*.005}
  };
}
