// ==UserScript==
// @name        DS: Raubzug Rechner
// @namespace   Ichaelus
// @version     1.0.0
// @author      Ichaelus
// @description Display an "optimal" inline unit distrubution for the different scavenge options
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
if(W.game_data.screen == 'place' && W.game_data.mode == 'scavenge'){
  W.Timing.whenReady(function(){
      // ScavengeScreen is loaded asynchronously, we have to delay ourselfs
      setTimeout(function(){
          // Show the calculation once and then again if the user clicks any button
          updateCalculation()
          document.querySelector('.options-container').onclick = updateCalculation
      }, 250)
  })
}

function updateCalculation(){
    console.log("Calculation unit distribution..")
    // Clear previous calculations
    const table = document.querySelector('.candidate-squad-widget')
    table.querySelectorAll('.distribution-preview').forEach((node) => node.remove())
    // Filter out locked and currently used options
    const availableOptions = Object.values(W.ScavengeScreen.village.options).filter((option) => !option.isLocked() && !option.scavenging_squad)
    /*
      Every loot option has a different "loot factor" ranging from 0.1 to 0.75. It controls how long the troops will be on the way.
      We must (invertedly) apply these weights to the options to obtain a uniform scavenging speed.
    */
    const totalWeight = availableOptions.reduce((sum, option) => sum += 1 / option.base.loot_factor, 0)
    const unitDistribution = {}

    for(let key in availableOptions){
        const option = availableOptions[key]
        // Calculate optimal distribution
        let previewRow = document.createElement('tr')
        previewRow.classList.add('distribution-preview')
        let optionCapacity = 0
        unitDistribution[key] = {}
        for(let unitName in W.ScavengeScreen.village.unit_counts_home){
            if(Object.keys(W.ScavengeScreen.units_calculator.units).includes(unitName)){
                const totalUnits = W.ScavengeScreen.village.unit_counts_home[unitName]
                const unitsShare = (1 / option.base.loot_factor) / totalWeight
                // Example: Of total 20 units (1/0.1 = 10) of 16 shares (62.5% = 12.5 units) are used for this option
                const optionUnits = Math.round(totalUnits * unitsShare)
                unitDistribution[key][unitName] = optionUnits
                optionCapacity += W.ScavengeScreen.units_calculator.units[unitName].carry * optionUnits
            }
        }
        // Render distribution suggestion for this option
        previewRow.innerHTML = `
            <td>${unitDistribution[key].spear}</td>
            <td>${unitDistribution[key].sword}</td>
            <td>${unitDistribution[key].axe}</td>
            <td>${unitDistribution[key].archer}</td>
            <td>${unitDistribution[key].light}</td>
            <td>${unitDistribution[key].marcher}</td>
            <td>${unitDistribution[key].heavy}</td>
            <td>${unitDistribution[key].knight}</td>
            <td class="squad-village-required">Option ${option.base.id}</td>
            <td class="carry-max">${parseFloat(optionCapacity).toLocaleString('de')}</td></tr>
        `
        table.appendChild(previewRow)
    }
}
