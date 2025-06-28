document.getElementById('registrationForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  // Validaciones y envío aquí
});

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('registrationForm').reset();
}