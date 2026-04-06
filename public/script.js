// Stan logowania i lista ofert na stronie głównej

async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const user = await res.json();
            document.getElementById('userName').innerText = `👤 ${user.username}`;
            document.getElementById('dashboardLink').style.display = 'inline';
            document.getElementById('offerLink').style.display = 'inline';
            document.getElementById('logoutBtn').style.display = 'inline-block';
            document.getElementById('loginLink').style.display = 'none';
            document.getElementById('registerLink').style.display = 'none';
        } else {
            document.getElementById('userName').innerText = '';
            document.getElementById('dashboardLink').style.display = 'none';
            document.getElementById('offerLink').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'none';
            document.getElementById('loginLink').style.display = 'inline';
            document.getElementById('registerLink').style.display = 'inline';
        }
    } catch(e) { console.error(e); }
}

async function loadOffers() {
    const container = document.getElementById('offersList');
    if (!container) return;
    try {
        const res = await fetch('/api/offers');
        const offers = await res.json();
        if (offers.length === 0) {
            container.innerHTML = '<p>Brak aktywnych ofert. 😢</p>';
            return;
        }
        container.innerHTML = offers.map(offer => `
            <div class="offer">
                <h3>${escapeHtml(offer.item_name)}</h3>
                <p>🌍 Serwer: ${escapeHtml(offer.server)}</p>
                <p>💰 Cena: ${offer.price} zł</p>
                <p>👤 Sprzedający: ${escapeHtml(offer.seller_name)} (⭐ ${offer.seller_rating || 'nowy'})</p>
                <button onclick="buyOffer(${offer.id})">Kup teraz</button>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = '<p>Błąd ładowania ofert.</p>';
    }
}

window.buyOffer = async (offerId) => {
    const res = await fetch(`/api/buy/${offerId}`, { method: 'POST' });
    if (res.ok) {
        const data = await res.json();
        alert(`Transakcja rozpoczęta! ID: ${data.transactionId}. Przejdź do dashboardu.`);
        window.location.href = 'dashboard.html';
    } else {
        const err = await res.json();
        alert('Błąd: ' + err.error);
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
});

checkAuth();
loadOffers();
