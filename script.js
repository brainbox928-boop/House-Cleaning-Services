/* Brightwell booking configuration: adjust prices, contact details, and service options here. */
const BRIGHTWELL_CONFIG = {
  currency: 'USD',
  locale: 'en-US',
  contact: {
    phoneLabel: '(555) 014-8200',
    phoneHref: '+15550148200',
    email: 'hello@brightwellhome.com'
  },
  pricing: {
    // Base service prices include one bedroom and one bathroom.
    services: {
      standard: { label: 'Standard clean', basePrice: 119, description: 'Routine home refresh' },
      deep: { label: 'Deep clean', basePrice: 179, description: 'Detailed top-to-bottom clean' },
      move: { label: 'Move in / out clean', basePrice: 239, description: 'Empty-home move clean' }
    },
    rooms: {
      bedrooms: { label: 'Bedroom', included: 1, pricePerRoom: 20, minimum: 1, maximum: 8 },
      bathrooms: { label: 'Bathroom', included: 1, pricePerRoom: 25, minimum: 1, maximum: 6 }
    },
    homeSize: {
      standard: { label: 'Typical home', multiplier: 1 },
      large: { label: 'Large home (2,500+ sq ft)', multiplier: 1.15 }
    },
    addons: [
      { id: 'oven', label: 'Inside oven', detail: 'A fresh start for your oven', price: 35 },
      { id: 'windows', label: 'Interior windows', detail: 'Up to 10 accessible windows', price: 25 },
      { id: 'fridge', label: 'Inside refrigerator', detail: 'Shelves and drawers included', price: 25 },
      { id: 'laundry', label: 'One load of laundry', detail: 'Wash, dry and fold', price: 20 }
    ],
    frequencies: {
      once: { label: 'One-time', discount: 0 },
      weekly: { label: 'Weekly', discount: 0.15 },
      biweekly: { label: 'Every 2 weeks', discount: 0.10 },
      monthly: { label: 'Monthly', discount: 0.05 }
    }
  },
  booking: {
    defaultService: 'standard',
    defaultFrequency: 'once',
    defaultBedrooms: 2,
    defaultBathrooms: 2,
    currencyFractionDigits: 0
  }
};

/* Cache the page controls once so each interaction can update the same view. */
const bookingForm = document.querySelector('#bookingForm');
const serviceSelect = document.querySelector('#serviceType');
const frequencySelect = document.querySelector('#frequency');
const homeSizeSelect = document.querySelector('#homeSize');
const totalPrice = document.querySelector('#totalPrice');
const summaryTotal = document.querySelector('#summaryTotal');
const priceBreakdown = document.querySelector('#priceBreakdown');
const discountLine = document.querySelector('#discountLine');
const discountLabel = document.querySelector('#discountLabel');
const discountAmount = document.querySelector('#discountAmount');
const bedroomsOutput = document.querySelector('#bedroomsOutput');
const bathroomsOutput = document.querySelector('#bathroomsOutput');
const confirmationModalElement = document.querySelector('#confirmationModal');
const confirmationModal = window.bootstrap ? new bootstrap.Modal(confirmationModalElement) : null;
const roomCounts = {
  bedrooms: BRIGHTWELL_CONFIG.booking.defaultBedrooms,
  bathrooms: BRIGHTWELL_CONFIG.booking.defaultBathrooms
};

/* Keep all displayed currency consistent with the configured locale. */
function formatCurrency(amount) {
  return new Intl.NumberFormat(BRIGHTWELL_CONFIG.locale, {
    style: 'currency',
    currency: BRIGHTWELL_CONFIG.currency,
    minimumFractionDigits: BRIGHTWELL_CONFIG.booking.currencyFractionDigits,
    maximumFractionDigits: BRIGHTWELL_CONFIG.booking.currencyFractionDigits
  }).format(amount);
}

/* Build service and frequency choices from the central data model. */
function populateSelectOptions() {
  Object.entries(BRIGHTWELL_CONFIG.pricing.services).forEach(([value, service]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = service.label;
    serviceSelect.append(option);
  });
  serviceSelect.value = BRIGHTWELL_CONFIG.booking.defaultService;

  Object.entries(BRIGHTWELL_CONFIG.pricing.frequencies).forEach(([value, frequency]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = frequency.discount
      ? `${frequency.label} · Save ${Math.round(frequency.discount * 100)}%`
      : frequency.label;
    frequencySelect.append(option);
  });
  frequencySelect.value = BRIGHTWELL_CONFIG.booking.defaultFrequency;
}

/* Render optional extras from the data model instead of hard-coding UI choices. */
function renderAddons() {
  const addonList = document.querySelector('#addonsList');
  const addonMarkup = BRIGHTWELL_CONFIG.pricing.addons.map((addon) => `
    <label class="addon-option" for="addon-${addon.id}">
      <input type="checkbox" id="addon-${addon.id}" name="addons" value="${addon.id}" data-addon-price="${addon.price}">
      <span class="addon-copy"><span class="addon-name">${addon.label}</span><span class="addon-price">${addon.detail}</span></span>
      <span class="addon-price-amount">+${formatCurrency(addon.price)}</span>
    </label>`).join('');
  addonList.innerHTML = addonMarkup;
}

/* Compute the current pre-discount price and each line-item for the summary. */
function calculateQuote() {
  const service = BRIGHTWELL_CONFIG.pricing.services[serviceSelect.value];
  if (!service) return { subtotal: 0, discount: 0, total: 0, lines: [] };

  const pricing = BRIGHTWELL_CONFIG.pricing;
  const sizeOption = pricing.homeSize[homeSizeSelect.value] || pricing.homeSize.standard;
  const roomPrice = Object.entries(pricing.rooms).reduce((sum, [roomName, roomConfig]) => {
    const extraRooms = Math.max(0, roomCounts[roomName] - roomConfig.included);
    return sum + extraRooms * roomConfig.pricePerRoom;
  }, 0);
  const selectedAddons = pricing.addons.filter((addon) => {
    return document.querySelector(`#addon-${addon.id}`).checked;
  });
  const addonsPrice = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  const serviceAndRooms = (service.basePrice + roomPrice) * sizeOption.multiplier;
  const subtotal = Math.round(serviceAndRooms + addonsPrice);
  const frequency = pricing.frequencies[frequencySelect.value] || pricing.frequencies.once;
  const discount = Math.round(subtotal * frequency.discount);
  const total = Math.max(0, subtotal - discount);
  const lines = [
    { label: service.label, amount: service.basePrice },
    { label: `${roomCounts.bedrooms} bedroom${roomCounts.bedrooms === 1 ? '' : 's'} · ${roomCounts.bathrooms} bathroom${roomCounts.bathrooms === 1 ? '' : 's'}`, amount: roomPrice },
    ...(sizeOption.multiplier !== 1 ? [{ label: sizeOption.label, amount: serviceAndRooms - service.basePrice - roomPrice }] : []),
    ...selectedAddons.map((addon) => ({ label: addon.label, amount: addon.price }))
  ];

  return { subtotal, discount, total, lines, frequency };
}

/* Refresh the quote, discount message, and visible room-counter values together. */
function updateQuote() {
  const quote = calculateQuote();
  bedroomsOutput.value = roomCounts.bedrooms;
  bathroomsOutput.value = roomCounts.bathrooms;
  bedroomsOutput.textContent = roomCounts.bedrooms;
  bathroomsOutput.textContent = roomCounts.bathrooms;
  totalPrice.textContent = formatCurrency(quote.total);
  summaryTotal.textContent = formatCurrency(quote.total);

  if (quote.lines.length) {
    priceBreakdown.innerHTML = quote.lines.map((line) => `
      <div class="summary-line"><span>${line.label}</span><span>${formatCurrency(line.amount)}</span></div>`).join('');
  } else {
    priceBreakdown.innerHTML = '<div class="summary-placeholder">Choose a service to see your personalized estimate.</div>';
  }

  if (quote.discount > 0) {
    discountLine.classList.remove('d-none');
    discountLabel.textContent = `${quote.frequency.label} savings`;
    discountAmount.textContent = `−${formatCurrency(quote.discount)}`;
  } else {
    discountLine.classList.add('d-none');
  }
}

/* Keep Move In / Out bookings one-time, since recurring move cleans do not make sense. */
function updateFrequencyAvailability() {
  const isMoveClean = serviceSelect.value === 'move';
  Array.from(frequencySelect.options).forEach((option) => {
    option.disabled = isMoveClean && option.value !== 'once';
  });
  if (isMoveClean) frequencySelect.value = 'once';
}

/* Clamp bedroom and bathroom controls at the configured safe ranges. */
function handleRoomCounter(event) {
  const button = event.target.closest('[data-room-action]');
  if (!button) return;
  const roomName = button.dataset.room;
  const roomConfig = BRIGHTWELL_CONFIG.pricing.rooms[roomName];
  if (!roomConfig) return;

  const direction = button.dataset.roomAction === 'increment' ? 1 : -1;
  roomCounts[roomName] = Math.min(roomConfig.maximum, Math.max(roomConfig.minimum, roomCounts[roomName] + direction));
  updateQuote();
}

/* Link the hero's quick estimate to the same counters and service selection. */
function handleQuickEstimate(event) {
  event.preventDefault();
  roomCounts.bedrooms = Number(document.querySelector('#quickBedrooms').value);
  roomCounts.bathrooms = Number(document.querySelector('#quickBathrooms').value);
  updateQuote();
  document.querySelector('#booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
  serviceSelect.focus({ preventScroll: true });
}

/* Format card details locally for usability; these values are never transmitted. */
function formatCardNumber(event) {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 19);
  event.target.value = digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatCardExpiry(event) {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
  event.target.value = digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

/* Validate card-number shape and checksum without sending it to any service. */
function passesLuhnCheck(cardNumber) {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/* Reject expired month/year combinations while retaining the native form workflow. */
function validateCardExpiry() {
  const expiryInput = document.querySelector('#cardExpiry');
  const match = expiryInput.value.match(/^(0[1-9]|1[0-2])\s?\/\s?(\d{2})$/);
  if (!match) {
    expiryInput.setCustomValidity('Enter an expiry date in MM / YY format.');
    return false;
  }

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const now = new Date();
  const isExpired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  expiryInput.setCustomValidity(isExpired ? 'This card appears to be expired.' : '');
  return !isExpired;
}

/* Populate the success state from the validated request and the current quote. */
function showConfirmation() {
  const formData = new FormData(bookingForm);
  const quote = calculateQuote();
  const date = new Date(`${formData.get('cleaningDate')}T12:00:00`);
  const service = BRIGHTWELL_CONFIG.pricing.services[formData.get('serviceType')];
  const confirmationNumber = `BW-${Date.now().toString().slice(-6)}`;

  document.querySelector('#confirmationName').textContent = formData.get('customerName').trim().split(/\s+/)[0];
  document.querySelector('#confirmationNumber').textContent = confirmationNumber;
  document.querySelector('#confirmationDate').textContent = new Intl.DateTimeFormat(BRIGHTWELL_CONFIG.locale, {
    month: 'long', day: 'numeric', year: 'numeric'
  }).format(date);
  document.querySelector('#confirmationService').textContent = service.label;
  document.querySelector('#confirmationTotal').textContent = formatCurrency(quote.total);
  confirmationModal.show();
}

/* Use native constraint validation plus explicit checks for demo card fields. */
function handleBookingSubmit(event) {
  event.preventDefault();
  const cardNumberInput = document.querySelector('#cardNumber');
  cardNumberInput.setCustomValidity(passesLuhnCheck(cardNumberInput.value) ? '' : 'Enter a valid-looking card number for this demo.');
  validateCardExpiry();

  if (!bookingForm.checkValidity()) {
    event.stopPropagation();
    bookingForm.classList.add('was-validated');
    const invalidField = bookingForm.querySelector(':invalid');
    invalidField?.focus({ preventScroll: false });
    return;
  }

  bookingForm.classList.add('was-validated');
  showConfirmation();
}

/* Apply centrally managed contact information and set date input bounds. */
function applyBusinessDetails() {
  document.querySelectorAll('[data-contact-phone]').forEach((phoneLink) => {
    phoneLink.href = `tel:${BRIGHTWELL_CONFIG.contact.phoneHref}`;
  });
  document.querySelectorAll('[data-contact-phone-label]').forEach((phoneLabel) => {
    phoneLabel.textContent = BRIGHTWELL_CONFIG.contact.phoneLabel;
  });
  document.querySelectorAll('[data-contact-email]').forEach((emailLink) => {
    emailLink.href = `mailto:${BRIGHTWELL_CONFIG.contact.email}`;
    if (emailLink.textContent.includes('@')) emailLink.textContent = BRIGHTWELL_CONFIG.contact.email;
  });
  document.querySelector('#currentYear').textContent = new Date().getFullYear();

  const dateInput = document.querySelector('#cleaningDate');
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateInput.min = localToday;
}

/* Route service cards into the booking form with that service preselected. */
function handleServiceCardClick(event) {
  const serviceLink = event.target.closest('[data-select-service]');
  if (!serviceLink) return;
  serviceSelect.value = serviceLink.dataset.selectService;
  updateFrequencyAvailability();
  updateQuote();
}

/* Initialize data-driven choices and all user-facing interactions. */
function initializeBrightwellBooking() {
  applyBusinessDetails();
  populateSelectOptions();
  renderAddons();
  updateQuote();

  document.querySelector('#quickEstimate').addEventListener('submit', handleQuickEstimate);
  document.querySelector('.room-counter-grid').addEventListener('click', handleRoomCounter);
  document.querySelectorAll('#serviceType, #frequency, #homeSize, #addonsList').forEach((element) => {
    element.addEventListener('change', () => {
      if (element === serviceSelect) updateFrequencyAvailability();
      updateQuote();
    });
  });
  document.querySelector('#services').addEventListener('click', handleServiceCardClick);
  document.querySelector('#cardNumber').addEventListener('input', formatCardNumber);
  document.querySelector('#cardExpiry').addEventListener('input', formatCardExpiry);
  bookingForm.addEventListener('input', (event) => event.target.setCustomValidity(''));
  bookingForm.addEventListener('submit', handleBookingSubmit);
}

initializeBrightwellBooking();
