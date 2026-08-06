const endTurnButton = document.querySelector('#endTurn');
const playerHeroPower = document.querySelector('.player-hero-power');
const playerLane = document.querySelector('.player-lane');
const board = document.querySelector('#board');
const battlefield = document.querySelector('.battlefield');
const attackArrows = document.querySelector('#attackArrows');
const opponentHero = document.querySelector('.opponent-hero-hit');
const playerManaBar = document.querySelector('.player-mana-bar');
const playerManaCount = playerManaBar.querySelector('.mana-count');
const playerManaCrystals = [...playerManaBar.querySelectorAll('.crystal')];
const opponentManaBar = document.querySelector('.opponent-mana-bar');
const opponentManaCount = opponentManaBar.querySelector('.mana-count');
const opponentManaCrystals = [...opponentManaBar.querySelectorAll('.crystal')];
const playerDeck = document.querySelector('.player-deck');
const playerDeckCount = playerDeck.querySelector('.deck-count');
const opponentDeck = document.querySelector('.opponent-deck');
const opponentDeckCount = opponentDeck.querySelector('.deck-count');
const playerHand = document.querySelector('.player-hand-cards');
const opponentHand = document.querySelector('.opponent-hand-cards');
const handPreview = document.querySelector('.hand-card-preview');
const soldiers = [];
const MAX_HAND_SIZE = 10;
const HERO_POWER_COST = 2;
let playerMaxMana = 0;
let playerCurrentMana = 0;
let opponentMaxMana = 0;
let opponentCurrentMana = 0;
let playerDeckCards = 30;
let opponentDeckCards = 30;
let opponentHandCards = 0;
let activeArrow = null;
let activeArrowHead = null;
let arrowStart = null;
let isDraggingAttack = false;
let attackingSoldier = null;
let attackingSoldierState = null;
let opponentHeroHp = 30;
let activeAttackWarning = null;
let activeDamageIndicator = null;
let burnRevealTimer = null;
let burnFinishTimer = null;
let creaturePreviewTimer = null;

function showAttackWarning(soldier) {
  if (activeAttackWarning) activeAttackWarning.remove();
  const boardRect = board.getBoundingClientRect();
  const soldierRect = soldier.getBoundingClientRect();
  const warning = document.createElement('div');
  warning.className = 'attack-warning';
  warning.textContent = 'This creature cannot attack this turn';
  warning.style.left = `${soldierRect.left + soldierRect.width / 2 - boardRect.left}px`;
  warning.style.top = `${soldierRect.top - boardRect.top - 10}px`;
  board.appendChild(warning);
  activeAttackWarning = warning;
  window.setTimeout(() => warning.classList.add('warning-fade'), 650);
  window.setTimeout(() => {
    warning.remove();
    if (activeAttackWarning === warning) activeAttackWarning = null;
  }, 1000);
}

function showDamageIndicator(target, amount) {
  if (activeDamageIndicator) activeDamageIndicator.remove();
  const boardRect = board.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const indicator = document.createElement('div');
  indicator.className = 'damage-indicator';
  indicator.textContent = `-${amount}`;
  indicator.style.left = `${targetRect.left + targetRect.width / 2 - boardRect.left}px`;
  indicator.style.top = `${targetRect.top + targetRect.height / 2 - boardRect.top}px`;
  board.appendChild(indicator);
  activeDamageIndicator = indicator;
  window.setTimeout(() => {
    indicator.remove();
    if (activeDamageIndicator === indicator) activeDamageIndicator = null;
  }, 900);
}

function pointIsInside(element, x, y) {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function animateManaCrystals(crystals, activeCount, newCrystalIndex) {
  crystals.forEach((crystal, index) => {
    crystal.classList.remove('mana-crystal-refresh', 'mana-crystal-fade-in');
    if (index < activeCount) {
      crystal.style.setProperty('--crystal-delay', `${index * 35}ms`);
      const animationClass = index === newCrystalIndex ? 'mana-crystal-fade-in' : 'mana-crystal-refresh';
      window.requestAnimationFrame(() => crystal.classList.add(animationClass));
    }
  });
}

function updateManaCrystals(crystals, currentMana, maxMana) {
  crystals.forEach((crystal, index) => {
    crystal.classList.toggle('filled', index < currentMana);
    crystal.classList.toggle('spent', index >= currentMana && index < maxMana);
  });
}

function updateHeroPowerAvailability() {
  const isYourTurn = endTurnButton.classList.contains('your-turn');
  const wasUsed = playerHeroPower.classList.contains('hero-power-used');
  playerHeroPower.disabled = !isYourTurn || wasUsed || playerCurrentMana < HERO_POWER_COST;
  playerHeroPower.title = playerCurrentMana < HERO_POWER_COST && !wasUsed
    ? `Hero power costs ${HERO_POWER_COST} mana`
    : '';
}

function drawCardFromDeck(deck, countElement, owner) {
  const currentCount = owner === 'player' ? playerDeckCards : opponentDeckCards;
  if (currentCount <= 0) return false;
  const nextCount = Math.max(0, currentCount - 1);
  if (owner === 'player') playerDeckCards = nextCount;
  else opponentDeckCards = nextCount;
  countElement.textContent = `${nextCount} cards`;
  deck.setAttribute('aria-label', `${owner === 'player' ? 'Your' : 'Opponent'} deck: ${nextCount} cards`);
  return true;
}

function arrangePlayerHand() {
  const cards = [...playerHand.children];
  const availableWidth = playerHand.clientWidth || 600;
  const cardWidth = cards[0]?.offsetWidth || 0;
  const desiredGap = 10;
  const gap = cards.length > 1
    ? Math.min(desiredGap, (availableWidth - cardWidth * cards.length) / (cards.length - 1))
    : 0;
  const center = (cards.length - 1) / 2;
  const rotationStep = Math.min(3.5, 35 / Math.max(1, cards.length - 1));
  cards.forEach((card, index) => {
    const offset = index - center;
    const lift = Math.min(30, Math.abs(offset) * 3);
    const rotation = offset * rotationStep;
    card.style.marginLeft = index === 0 ? '0px' : `${gap}px`;
    card.style.setProperty('--hand-rotation', `${rotation}deg`);
    card.style.transform = `translateY(-${lift}px) rotate(${rotation}deg)`;
    card.style.zIndex = String(index + 1);
  });
}

function animateCardDraw(card, owner = 'player') {
  const boardRect = board.getBoundingClientRect();
  const deck = owner === 'opponent' ? opponentDeck : playerDeck;
  const deckRect = deck.getBoundingClientRect();
  const targetRect = card.getBoundingClientRect();
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;
  const startX = deckRect.left + deckRect.width / 2 - boardRect.left;
  const startY = deckRect.top + deckRect.height / 2 - boardRect.top;
  const targetX = targetRect.left + targetRect.width / 2 - boardRect.left;
  const targetY = targetRect.top + targetRect.height / 2 - boardRect.top;
  const flight = document.createElement('div');
  flight.className = 'draw-card-flight';
  if (owner === 'opponent') flight.classList.add('draw-card-flight-opponent');
  flight.style.left = `${startX - cardWidth / 2}px`;
  flight.style.top = `${startY - cardHeight / 2}px`;
  flight.style.width = `${cardWidth}px`;
  flight.style.height = `${cardHeight}px`;
  flight.style.setProperty('--draw-x', `${targetX - startX}px`);
  flight.style.setProperty('--draw-y', `${targetY - startY}px`);
  flight.style.setProperty('--draw-rotation', card.style.getPropertyValue('--hand-rotation') || '0deg');
  board.appendChild(flight);
  card.classList.add('hand-card-drawing');
  window.setTimeout(() => {
    flight.remove();
    card.classList.remove('hand-card-drawing');
  }, 620);
}

function arrangeOpponentHand() {
  const cards = [...opponentHand.children];
  const availableWidth = opponentHand.clientWidth || 600;
  const cardWidth = cards[0]?.offsetWidth || 0;
  const desiredGap = 10;
  const gap = cards.length > 1
    ? Math.min(desiredGap, (availableWidth - cardWidth * cards.length) / (cards.length - 1))
    : 0;
  const center = (cards.length - 1) / 2;
  const rotationStep = Math.min(3.5, 35 / Math.max(1, cards.length - 1));
  cards.forEach((card, index) => {
    const offset = index - center;
    const lift = Math.min(30, Math.abs(offset) * 3);
    const rotation = offset * rotationStep;
    card.style.marginLeft = index === 0 ? '0px' : `${gap}px`;
    card.style.setProperty('--hand-rotation', `${rotation}deg`);
    card.style.transform = `translateY(${lift}px) rotate(${rotation}deg)`;
    card.style.zIndex = String(index + 1);
  });
}

function setHandPreviewContent(content) {
  handPreview.innerHTML = `<div class="hand-preview-soldier">${content}</div>`;
}

function showCreaturePreview(soldier) {
  window.clearTimeout(creaturePreviewTimer);
  creaturePreviewTimer = window.setTimeout(() => {
    setHandPreviewContent(`<span class="hand-card-cost">1</span>${soldierMarkup}`);
    handPreview.classList.add('hand-card-preview-visible');
    handPreview.setAttribute('aria-hidden', 'false');
  }, 250);
}

function hideCreaturePreview() {
  window.clearTimeout(creaturePreviewTimer);
  handPreview.classList.remove('hand-card-preview-visible');
  handPreview.setAttribute('aria-hidden', 'true');
  handPreview.innerHTML = '';
}

function playSoldierCard(card) {
  if (!endTurnButton.classList.contains('your-turn') || playerCurrentMana < 1 || soldiers.length >= 7) {
    card.classList.add('hand-card-unplayable');
    window.setTimeout(() => card.classList.remove('hand-card-unplayable'), 350);
    return;
  }

  const sourceRect = card.getBoundingClientRect();
  playerCurrentMana -= 1;
  playerManaCount.textContent = `${playerCurrentMana} / ${playerMaxMana}`;
  updateManaCrystals(playerManaCrystals, playerCurrentMana, playerMaxMana);
  playerManaBar.setAttribute('aria-label', `Your mana: ${playerCurrentMana} of ${playerMaxMana}`);
  handPreview.classList.remove('hand-card-preview-visible');
  handPreview.setAttribute('aria-hidden', 'true');
  handPreview.innerHTML = '';
  playerHand.removeChild(card);
  arrangePlayerHand();
  soldiers.push({ hasAttacked: false, summoningSick: true });
  renderSoldiers();
  const soldierIndex = soldiers.length - 1;
  const target = playerLane.querySelector(`[data-soldier-index="${soldierIndex}"]`);
  if (!target) return;
  const targetRect = target.getBoundingClientRect();
  target.style.setProperty('--summon-x', `${sourceRect.left + sourceRect.width / 2 - targetRect.left - targetRect.width / 2}px`);
  target.style.setProperty('--summon-y', `${sourceRect.top + sourceRect.height / 2 - targetRect.top - targetRect.height / 2}px`);
  target.classList.add('creature-summoning');
  window.setTimeout(() => {
    target.classList.remove('creature-summoning');
    target.style.removeProperty('--summon-x');
    target.style.removeProperty('--summon-y');
  }, 820);
}

function addBlankCardToHand() {
  if (playerHand.children.length >= MAX_HAND_SIZE) return;
  const card = document.createElement('div');
  card.className = 'hand-card hand-card-blank hand-card-soldier';
  card.innerHTML = `<span class="hand-card-cost">1</span>${soldierMarkup}`;
  card.setAttribute('aria-label', 'Soldier card: costs 1 mana, 1 attack, 1 health');
  let hoverTimer = null;
  card.addEventListener('pointerenter', () => {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      card.classList.add('hand-card-hovered');
      card.style.zIndex = '100';
      setHandPreviewContent(card.innerHTML);
      handPreview.classList.add('hand-card-preview-visible');
      handPreview.setAttribute('aria-hidden', 'false');
    }, 250);
  });
  card.addEventListener('pointerleave', () => {
    window.clearTimeout(hoverTimer);
    card.classList.remove('hand-card-hovered');
    handPreview.classList.remove('hand-card-preview-visible');
    handPreview.setAttribute('aria-hidden', 'true');
    handPreview.innerHTML = '';
    arrangePlayerHand();
  });
  card.addEventListener('click', () => playSoldierCard(card));
  playerHand.appendChild(card);
  arrangePlayerHand();
  animateCardDraw(card);
}

function addOpponentCardToHand() {
  if (opponentHandCards >= MAX_HAND_SIZE) return;
  const card = document.createElement('div');
  card.className = 'opponent-hand-card';
  card.setAttribute('aria-label', 'Opponent card back');
  opponentHand.appendChild(card);
  arrangeOpponentHand();
  animateCardDraw(card, 'opponent');
}

function showBurnedCard() {
  window.clearTimeout(burnRevealTimer);
  window.clearTimeout(burnFinishTimer);
  handPreview.classList.remove('hand-card-preview-visible', 'hand-card-preview-burning', 'hand-card-preview-melted');
  handPreview.setAttribute('aria-hidden', 'false');
  setHandPreviewContent(`<span class="hand-card-cost">1</span>${soldierMarkup}`);
  window.requestAnimationFrame(() => {
    handPreview.classList.add('hand-card-preview-visible');
  });
  burnRevealTimer = window.setTimeout(() => {
    handPreview.classList.add('hand-card-preview-burning');
  }, 1500);
  burnFinishTimer = window.setTimeout(() => {
    handPreview.classList.remove('hand-card-preview-burning');
    handPreview.classList.add('hand-card-preview-melted');
    window.setTimeout(() => {
      handPreview.classList.remove('hand-card-preview-visible', 'hand-card-preview-melted');
      handPreview.setAttribute('aria-hidden', 'true');
    }, 220);
  }, 2780);
}

function drawPlayerCard() {
  if (!drawCardFromDeck(playerDeck, playerDeckCount, 'player')) return;
  if (playerHand.children.length >= MAX_HAND_SIZE) {
    showBurnedCard();
    return;
  }
  addBlankCardToHand();
}

function drawOpponentCard() {
  if (!drawCardFromDeck(opponentDeck, opponentDeckCount, 'opponent')) return;
  if (opponentHandCards >= MAX_HAND_SIZE) {
    showBurnedCard();
    return;
  }
  opponentHandCards += 1;
  addOpponentCardToHand();
}

function startPlayerTurn() {
  drawPlayerCard();
  soldiers.forEach((soldier) => {
    soldier.hasAttacked = false;
    soldier.summoningSick = false;
  });
  renderSoldiers();
  playerLane.querySelectorAll('.slot-ring.has-attacked').forEach((soldier) => soldier.classList.remove('has-attacked'));
  const previousMaxMana = playerMaxMana;
  playerMaxMana = Math.min(10, playerMaxMana + 1);
  playerCurrentMana = playerMaxMana;
  playerManaCount.textContent = `${playerCurrentMana} / ${playerMaxMana}`;
  updateManaCrystals(playerManaCrystals, playerCurrentMana, playerMaxMana);
  animateManaCrystals(playerManaCrystals, playerMaxMana, previousMaxMana < playerMaxMana ? previousMaxMana : -1);
  playerManaBar.setAttribute('aria-label', `Your mana: ${playerCurrentMana} of ${playerMaxMana}`);
  updateHeroPowerAvailability();
}

function startOpponentTurn() {
  drawOpponentCard();
  const previousMaxMana = opponentMaxMana;
  opponentMaxMana = Math.min(10, opponentMaxMana + 1);
  opponentCurrentMana = opponentMaxMana;
  opponentManaCount.textContent = `${opponentCurrentMana} / ${opponentMaxMana}`;
  updateManaCrystals(opponentManaCrystals, opponentCurrentMana, opponentMaxMana);
  animateManaCrystals(opponentManaCrystals, opponentMaxMana, previousMaxMana < opponentMaxMana ? previousMaxMana : -1);
  opponentManaBar.setAttribute('aria-label', `Opponent mana: ${opponentCurrentMana} of ${opponentMaxMana}`);
}

const centeredLayouts = [
  [],
  [6],
  [5, 7],
  [4, 6, 8],
  [3, 5, 7, 9],
  [2, 4, 6, 8, 10],
  [1, 3, 5, 7, 9, 11],
  [0, 2, 4, 6, 8, 10, 12],
];

const soldierMarkup = '<span class="unit-name">SOLDIER</span><svg class="soldier-art" viewBox="0 0 32 40" aria-hidden="true"><circle cx="16" cy="6" r="4"></circle><path d="M16 10v13M16 14 7 21M16 14l7 4M16 23l-7 11M16 23l7 11"></path><path class="sword-blade" d="M24 15.5 25.5 16 31 3 23.5 14.5Z"></path><path class="sword-guard" d="M21 14.8 26 17.3"></path><path class="sword-grip" d="M23.5 16 21.5 20"></path><circle class="sword-pommel" cx="20.7" cy="21.2" r="1.7"></circle></svg><span class="unit-stats">1 / 1</span>';

function renderSoldiers() {
  const slots = [...playerLane.querySelectorAll('.slot-ring')];
  slots.forEach((slot) => {
    const slotType = slot.classList.contains('secondary-slot') ? 'secondary-slot' : 'primary-slot';
    slot.className = `slot-ring ${slotType}`;
    slot.innerHTML = '';
    slot.onpointerenter = null;
    slot.onpointerleave = null;
    slot.onmouseenter = null;
    slot.onmouseleave = null;
  });

  centeredLayouts[soldiers.length].forEach((slotIndex, soldierIndex) => {
    slots[slotIndex].classList.add('occupied');
    slots[slotIndex].dataset.soldierIndex = soldierIndex;
    if (soldiers[soldierIndex].hasAttacked) slots[slotIndex].classList.add('has-attacked');
    if (soldiers[soldierIndex].summoningSick) slots[slotIndex].classList.add('summoning-sick');
    slots[slotIndex].innerHTML = soldierMarkup;
    slots[slotIndex].onpointerenter = () => showCreaturePreview(slots[slotIndex]);
    slots[slotIndex].onpointerleave = hideCreaturePreview;
    slots[slotIndex].onmouseenter = () => showCreaturePreview(slots[slotIndex]);
    slots[slotIndex].onmouseleave = hideCreaturePreview;
  });
}

endTurnButton.addEventListener('click', () => {
  const isYourTurn = endTurnButton.classList.contains('your-turn');

  if (isYourTurn) {
    endTurnButton.classList.remove('your-turn');
    endTurnButton.classList.add('opponent-turn');
    endTurnButton.textContent = "OPPONENT'S TURN";
    startOpponentTurn();
    updateHeroPowerAvailability();
  } else {
    const heroPowerWasUsed = playerHeroPower.classList.contains('hero-power-used');
    endTurnButton.classList.remove('opponent-turn');
    endTurnButton.classList.add('your-turn');
    endTurnButton.textContent = 'END TURN';
    playerHeroPower.disabled = false;
    playerHeroPower.classList.remove('hero-power-used');
    playerHeroPower.querySelector('.hero-power-description').innerHTML = 'Summon a<br>1/1 soldier';
    if (heroPowerWasUsed) {
      playerHeroPower.classList.add('hero-power-flip-back');
      window.setTimeout(() => playerHeroPower.classList.remove('hero-power-flip-back'), 450);
    }
    startPlayerTurn();
    updateHeroPowerAvailability();
  }
});

playerHeroPower.addEventListener('click', () => {
  if (!endTurnButton.classList.contains('your-turn') || playerCurrentMana < HERO_POWER_COST) return;
  if (soldiers.length >= 7) {
    playerHeroPower.querySelector('.hero-power-description').textContent = 'Board is full';
    return;
  }

  playerCurrentMana -= HERO_POWER_COST;
  playerManaCount.textContent = `${playerCurrentMana} / ${playerMaxMana}`;
  updateManaCrystals(playerManaCrystals, playerCurrentMana, playerMaxMana);
  playerManaBar.setAttribute('aria-label', `Your mana: ${playerCurrentMana} of ${playerMaxMana}`);
  soldiers.push({ hasAttacked: false, summoningSick: true });
  renderSoldiers();
  playerHeroPower.disabled = true;
  playerHeroPower.classList.add('hero-power-used', 'hero-power-flip');
  playerHeroPower.querySelector('.hero-power-description').textContent = 'Used this turn';
  window.setTimeout(() => playerHeroPower.classList.remove('hero-power-flip'), 450);
  updateHeroPowerAvailability();
});

startPlayerTurn();

playerLane.addEventListener('pointerdown', (event) => {
  const soldier = event.target.closest('.slot-ring.occupied');
  if (!soldier) return;
  const soldierState = soldiers[Number(soldier.dataset.soldierIndex)];
  if (!soldierState || soldierState.hasAttacked || soldierState.summoningSick) {
    showAttackWarning(soldier);
    return;
  }

  event.preventDefault();
  const boardRect = board.getBoundingClientRect();
  const soldierRect = soldier.getBoundingClientRect();
  arrowStart = {
    x: soldierRect.left + soldierRect.width / 2 - boardRect.left,
    y: soldierRect.top + soldierRect.height / 2 - boardRect.top,
  };
  attackingSoldier = soldier;
  attackingSoldierState = soldierState;
  isDraggingAttack = true;

  if (activeArrow) activeArrow.remove();
  if (activeArrowHead) activeArrowHead.remove();
  activeArrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  activeArrow.setAttribute('x1', arrowStart.x);
  activeArrow.setAttribute('y1', arrowStart.y);
  activeArrow.setAttribute('x2', arrowStart.x);
  activeArrow.setAttribute('y2', arrowStart.y);
  attackArrows.appendChild(activeArrow);
  activeArrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  activeArrowHead.classList.add('attack-arrow-head');
  activeArrowHead.setAttribute('d', 'M -23 -17 L 23 0 L -23 17 Z');
  attackArrows.appendChild(activeArrowHead);
});

window.addEventListener('pointermove', (event) => {
  if (!isDraggingAttack || !activeArrow) return;
  const boardRect = board.getBoundingClientRect();
  const pointerX = event.clientX - boardRect.left;
  const pointerY = event.clientY - boardRect.top;
  const deltaX = pointerX - arrowStart.x;
  const deltaY = pointerY - arrowStart.y;
  const distance = Math.hypot(deltaX, deltaY);
  const arrowGap = Math.min(46, distance);
  const endRatio = distance ? (distance - arrowGap) / distance : 0;
  activeArrow.setAttribute('x2', arrowStart.x + deltaX * endRatio);
  activeArrow.setAttribute('y2', arrowStart.y + deltaY * endRatio);
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  const headCenterX = pointerX - (distance ? deltaX / distance : 1) * 23;
  const headCenterY = pointerY - (distance ? deltaY / distance : 0) * 23;
  activeArrowHead.setAttribute('transform', `translate(${headCenterX} ${headCenterY}) rotate(${angle})`);
  opponentHero.classList.toggle('hero-targeted', pointIsInside(opponentHero, event.clientX, event.clientY));
});

window.addEventListener('pointerup', (event) => {
  if (!isDraggingAttack) return;
  isDraggingAttack = false;
  const hitOpponentHero = pointIsInside(opponentHero, event.clientX, event.clientY);
  opponentHero.classList.remove('hero-targeted');

  if (hitOpponentHero && attackingSoldier) {
    const attackingElement = attackingSoldier;
    const attackingState = attackingSoldierState;
    const soldierRect = attackingElement.getBoundingClientRect();
    const targetRect = opponentHero.getBoundingClientRect();
    const attackX = targetRect.left + targetRect.width / 2 - soldierRect.left - soldierRect.width / 2;
    const attackY = targetRect.top + targetRect.height / 2 - soldierRect.top - soldierRect.height / 2;
    attackingElement.style.setProperty('--attack-x', `${attackX}px`);
    attackingElement.style.setProperty('--attack-y', `${attackY}px`);
    battlefield.classList.add('combat-active');
    attackingElement.classList.add('has-attacked', 'creature-attacking');
    attackingState.hasAttacked = true;
    window.setTimeout(() => {
      opponentHeroHp = Math.max(0, opponentHeroHp - 1);
      opponentHero.querySelector('span').textContent = `HERO-${opponentHeroHp}`;
      showDamageIndicator(opponentHero, 1);
      opponentHero.classList.add('hero-damaged');
      window.setTimeout(() => opponentHero.classList.remove('hero-damaged'), 400);
    }, 600);
    window.setTimeout(() => {
      battlefield.classList.remove('combat-active');
      attackingElement.classList.remove('creature-attacking');
      attackingElement.style.removeProperty('--attack-x');
      attackingElement.style.removeProperty('--attack-y');
    }, 980);
  }

  arrowStart = null;
  attackingSoldier = null;
  attackingSoldierState = null;
  if (activeArrow) {
    activeArrow.remove();
    activeArrow = null;
  }
  if (activeArrowHead) {
    activeArrowHead.remove();
    activeArrowHead = null;
  }
});

window.addEventListener('pointercancel', () => {
  isDraggingAttack = false;
  arrowStart = null;
  attackingSoldier = null;
  attackingSoldierState = null;
  opponentHero.classList.remove('hero-targeted');
  if (activeArrow) {
    activeArrow.remove();
    activeArrow = null;
  }
  if (activeArrowHead) {
    activeArrowHead.remove();
    activeArrowHead = null;
  }
});
