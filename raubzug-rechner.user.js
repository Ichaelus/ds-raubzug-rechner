// ==UserScript==
// @name        DS: Raubzug Rechner
// @version     1.1.0
// @namespace   Ichaelus
// @author      Ichaelus
// @copyright   Ichaelus
// @description Display an "optimal" inline unit distrubution for the different scavenge options
// @updateURL   https://raw.githubusercontent.com/Ichaelus/ds-raubzug-rechner/main/raubzug-rechner.user.js
// @include     *.die-staemme.de*
// @exclude     *.die-staemme.de
// @include     *.tribalwars.net*
// @include     *.staemme.ch*
// @include     *.tribalwars.nl*
// @include     *.plemiona.pl*
// @include     *.tribalwars.se*
// @include     *.tribalwars.com.pt*
// @include     *.divokekmeny.cz*
// @include     *.bujokjeonjaeng.org*
// @include     *.triburile.ro*
// @include     *.voyna-plemyon.ru*
// @include     *.fyletikesmaxes.gr*
// @include     *.tribalwars.no.com*
// @include     *.divoke-kmene.sk*
// @include     *.klanhaboru.hu*
// @include     *.tribalwars.dk*
// @include     *.tribals.it*
// @include     *.klanlar.org*
// @include     *.guerretribale.fr*
// @include     *.guerrastribales.es*
// @include     *.tribalwars.fi*
// @include     *.tribalwars.ae*
// @include     *.tribalwars.co.uk*
// @include     *.vojnaplemen.si*
// @include     *.plemena.com*
// @include     *.tribalwars.asia*
// @include     *.tribalwars.works*
// @include     *.tribalwars.us*
// @include     *.tribalwarsmasters.net*
// @include     *.tribalwars.com.br*
// @grant       unsafeWindow
// ==/UserScript==

// Only boot once in different frames
if (window.top !== window.self) {
  console.log('[#] Frame blocked')
  return
}

// Only boot on the right screen once everything is ready
const W = unsafeWindow
const rowClass = 'distribution-preview'
// Add units to the denyList that shouldn't be sent out
// Chose from: spear, sword, axe, archer, light, marcher, heavy, knight
const denyList = ['knight']
let unitsTable = null

if(W.game_data.screen == 'place' && W.game_data.mode == 'scavenge'){
  W.Timing.whenReady(function(){
      // ScavengeScreen is loaded asynchronously, we have to delay ourselfs
      setTimeout(function(){
          // Show the calculation once and then again if the user clicks any button
          unitsTable = document.querySelector('.candidate-squad-widget')
          markDenyList()
          updateCalculation()
          document.querySelector('.options-container').onclick = () => setTimeout(updateCalculation, 100)
      }, 250)
  })
}

function markDenyList(){
    denyList.forEach(function(unitName){
        unitsTable.querySelector(`th a[data-unit=${unitName}]`).style.opacity = 0.5
    })
}

function updateCalculation(){
    console.log("Calculation unit distribution..")
    clearLastCalculation()
    // Filter out locked and currently used options
    const availableOptions = Object.values(W.ScavengeScreen.village.options).filter((option) => !option.isLocked() && !option.scavenging_squad)
    /*
      Every loot option has a different "loot factor" ranging from 0.1 to 0.75. It controls how long the troops will be on the way.
      We must (invertedly) apply these weights to the options to obtain a uniform scavenging speed.
    */
    const totalWeight = availableOptions.reduce(function(sum, option){
        return sum + 1 / option.base.loot_factor
    }, 0)

    for(let key in availableOptions){
        const option = availableOptions[key]
        const unitDistribution = {}
        // Calculate optimal distribution
        let optionCapacity = 0
        for(let unitName in W.ScavengeScreen.village.unit_counts_home){
            if(Object.keys(W.ScavengeScreen.units_calculator.units).includes(unitName)){
                if(denyList.includes(unitName)){
                    unitDistribution[unitName] = 0
                }else{
                    const totalUnits = W.ScavengeScreen.village.unit_counts_home[unitName]
                    const unitsShare = (1 / option.base.loot_factor) / totalWeight
                    // Example: Of total 20 units (1/0.1 = 10) of 16 shares (62.5% = 12.5 units) are used for this option
                    const optionUnits = Math.round(totalUnits * unitsShare)

                    unitDistribution[unitName] = optionUnits
                    optionCapacity += W.ScavengeScreen.units_calculator.units[unitName].carry * optionUnits
                }
            }
        }
        renderDistributionSuggestion(option, unitDistribution, optionCapacity)
    }
}

function clearLastCalculation(){
    unitsTable.querySelectorAll(`.${rowClass}`).forEach((node) => node.remove())
}

function renderDistributionSuggestion(option, unitDistribution, capacity){
    const previewRow = document.createElement('tr')
    const buttonClass = 'send-distribution-button'
    previewRow.classList.add(rowClass)
    previewRow.classList.add(rowClass)
    previewRow.innerHTML = `
        <td>${unitDistribution.spear}</td>
        <td>${unitDistribution.sword}</td>
        <td>${unitDistribution.axe}</td>
        <td>${unitDistribution.archer}</td>
        <td>${unitDistribution.light}</td>
        <td>${unitDistribution.marcher}</td>
        <td>${unitDistribution.heavy}</td>
        <td>${unitDistribution.knight}</td>
        <td class="squad-village-required"><a href="#" class="btn btn-default ${buttonClass}">Option ${option.base.id} verschicken</a></td>
        <td class="carry-max">${parseFloat(capacity).toLocaleString('de')}</td></tr>`
    previewRow.querySelector(`.${buttonClass}`).onclick = sendSquad.bind(this, option, unitDistribution, capacity)
    unitsTable.appendChild(previewRow)
}

async function sendSquad(option, unitDistribution, capacity){
    const response = await fetch(`https://${W.document.location.host}/game.php?village=${W.game_data.village.id}&screen=scavenge_api&ajaxaction=send_squads`, {
        "credentials": "include",
        "headers": buildHeaders(),
        "referrer": `https://${W.document.location.host}/game.php?village=${W.game_data.village.id}&screen=place&mode=scavenge`,
        "body": buildRequestBody(option, unitDistribution, capacity),
        "method": "POST",
        "mode": "cors"
    });
    const newData = await response.json();
    if(newData.response.squad_responses[0].success){
        // Reload the page as:
        // a) The game data has changed (available units)
        // b) The CSRF Token might have changed!
        W.document.location.reload()
    }else{
        console.log(`Failed to send squads for Option ${option.base.id}: ${newData.response.squad_responses[0].error}`)
        alert(newData.response.squad_responses[0].error)
    }
    // Alternative: Use this data:
    // const newGameData = newData.game_data // use csrf token
    // const newOptions = newData.response.villages[game_data.village.id].options // use to decide next action
    // const newUnits = newData.response.villages[game_data.village.id].unit_counts_home // use to calculate next distribution
}

function buildRequestBody(option, unitDistribution, capacity){
    const body = {
        'squad_requests[0][village_id]': W.game_data.village.id.toString(),
        'squad_requests[0][candidate_squad][unit_counts][spear]': unitDistribution.spear.toString(),
        'squad_requests[0][candidate_squad][unit_counts][sword]': unitDistribution.sword.toString(),
        'squad_requests[0][candidate_squad][unit_counts][axe]': unitDistribution.axe.toString(),
        'squad_requests[0][candidate_squad][unit_counts][archer]': unitDistribution.archer.toString(),
        'squad_requests[0][candidate_squad][unit_counts][light]': unitDistribution.light.toString(),
        'squad_requests[0][candidate_squad][unit_counts][marcher]': unitDistribution.marcher.toString(),
        'squad_requests[0][candidate_squad][unit_counts][heavy]': unitDistribution.heavy.toString(),
        'squad_requests[0][candidate_squad][unit_counts][knight]': unitDistribution.knight.toString(),
        'squad_requests[0][candidate_squad][carry_max]': (capacity).toString(),
        'squad_requests[0][option_id]': (option.base.id).toString(),
        'squad_requests[0][use_premium]': (false).toString(),
        h: W.game_data.csrf,
    }
    const urlEncodedBody = Object.keys(body).map( (key) => `${encodeURIComponent(key)}=${body[key]}`).join('&')
    return urlEncodedBody;
}

function buildHeaders(){
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:87.0) Gecko/20100101 Firefox/87.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "de-DE,de;q=0.8,en-US;q=0.5,en;q=0.3",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "TribalWars-Ajax": "1",
        "X-Requested-With": "XMLHttpRequest",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
    }
}
