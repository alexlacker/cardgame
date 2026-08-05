const endTurnButton = document.querySelector('#endTurn');
const playerHeroPower = document.querySelector('.player-hero-power');
const playerLane = document.querySelector('.player-lane');
const board = document.querySelector('#board');
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
const soldiers = [];
const MAX_HAND_SIZE = 10;
let playerMaxMana = 0;
let playerCurrentMana = 0;
let opponentMaxMana = 0;
let opponentCurrentMana = 0;
let playerDeckCards = 30;
let opponentDeckCards = 30;
let activeArrow = null;
let activeArrowHead = null;
let arrowStart = null;
let isDraggingAttack = false;
let attackingSoldier = null;
let attackingSoldierState = null;
let opponentHeroHp = 30;
let activeAttackWarning = null;

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
    card.style.marginLeft = index === 0 ? '0px' : `${gap}px`;
    card.style.transform = `translateY(-${lift}px) rotate(${offset * rotationStep}deg)`;
    card.style.zIndex = String(cards.length - Math.abs(Math.round(offset)));
  });
}

function addBlankCardToHand() {
  if (playerHand.children.length >= MAX_HAND_SIZE) return;
  const card = document.createElement('div');
  card.className = 'hand-card hand-card-blank';
  card.setAttribute('aria-label', 'Blank card');
  let hoverTimer = null;
  card.addEventListener('pointerenter', () => {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      card.classList.add('hand-card-hovered');
      card.style.zIndex = '100';
    }, 250);
  });
  card.addEventListener('pointerleave', () => {
    window.clearTimeout(hoverTimer);
    card.classList.remove('hand-card-hovered');
    arrangePlayerHand();
  });
  playerHand.appendChild(card);
  arrangePlayerHand();
}

function startPlayerTurn() {
  if (drawCardFromDeck(playerDeck, playerDeckCount, 'player')) addBlankCardToHand();
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
  playerManaCrystals.forEach((crystal, index) => crystal.classList.toggle('filled', index < playerMaxMana));
  animateManaCrystals(playerManaCrystals, playerMaxMana, previousMaxMana < playerMaxMana ? previousMaxMana : -1);
  playerManaBar.setAttribute('aria-label', `Your mana: ${playerCurrentMana} of ${playerMaxMana}`);
}

function startOpponentTurn() {
  drawCardFromDeck(opponentDeck, opponentDeckCount, 'opponent');
  const previousMaxMana = opponentMaxMana;
  opponentMaxMana = Math.min(10, opponentMaxMana + 1);
  opponentCurrentMana = opponentMaxMana;
  opponentManaCount.textContent = `${opponentCurrentMana} / ${opponentMaxMana}`;
  opponentManaCrystals.forEach((crystal, index) => crystal.classList.toggle('filled', index < opponentMaxMana));
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
  });

  centeredLayouts[soldiers.length].forEach((slotIndex, soldierIndex) => {
    slots[slotIndex].classList.add('occupied');
    slots[slotIndex].dataset.soldierIndex = soldierIndex;
    if (soldiers[soldierIndex].hasAttacked) slots[slotIndex].classList.add('has-attacked');
    if (soldiers[soldierIndex].summoningSick) slots[slotIndex].classList.add('summoning-sick');
    slots[slotIndex].innerHTML = soldierMarkup;
  });
}

endTurnButton.addEventListener('click', () => {
  const isYourTurn = endTurnButton.classList.contains('your-turn');

  if (isYourTurn) {
    endTurnButton.classList.remove('your-turn');
    endTurnButton.classList.add('opponent-turn');
    endTurnButton.textContent = "OPPONENT'S TURN";
    startOpponentTurn();
  } else {
    const heroPowerWasUsed = playerHeroPower.classList.contains('hero-power-used');
    endTurnButton.classList.remove('opponent-turn');
    endTurnButton.classList.add('your-turn');
    endTurnButton.textContent = 'END TURN';
    playerHeroPower.disabled = false;
    playerHeroPower.classList.remove('hero-power-used');
    playerHeroPower.querySelector('span').innerHTML = 'Summon a<br>1/1 soldier';
    if (heroPowerWasUsed) {
      playerHeroPower.classList.add('hero-power-flip-back');
      window.setTimeout(() => playerHeroPower.classList.remove('hero-power-flip-back'), 450);
    }
    startPlayerTurn();
  }
});

playerHeroPower.addEventListener('click', () => {
  if (soldiers.length >= 7) {
    playerHeroPower.querySelector('span').textContent = 'Board is full';
    return;
  }

  soldiers.push({ hasAttacked: false, summoningSick: true });
  renderSoldiers();
  playerHeroPower.disabled = true;
  playerHeroPower.classList.add('hero-power-used', 'hero-power-flip');
  playerHeroPower.querySelector('span').textContent = 'Used this turn';
  window.setTimeout(() => playerHeroPower.classList.remove('hero-power-flip'), 450);
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
    opponentHeroHp = Math.max(0, opponentHeroHp - 1);
    opponentHero.querySelector('span').textContent = `HERO-${opponentHeroHp}`;
    attackingSoldier.classList.add('has-attacked');
    attackingSoldierState.hasAttacked = true;
    opponentHero.classList.add('hero-damaged');
    window.setTimeout(() => opponentHero.classList.remove('hero-damaged'), 400);
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
