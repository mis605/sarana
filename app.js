// Shared Configuration & Utility Functions for Sarana Gedung Web App

const GAS_URL = 'https://script.google.com/macros/s/AKfycby7-sTPf8QQRlFGJL7ZdsyJd-BXzTKt3jhBC6CdXDjwn7Rv43MJc7sYiZw37MNsxUNZxA/exec';

// --- Theme Handler ---
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    const isDark = body.getAttribute('data-bs-theme') === 'dark';
    body.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
    if (icon) icon.className = isDark ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-bs-theme', savedTheme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = savedTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}

// --- Offline Detector ---
function initOfflineDetector() {
    let banner = document.getElementById('offlineBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.innerHTML = '<i class="bi bi-wifi-off"></i><span>Mode Offline • Data & Draf tersimpan lokal</span>';
        document.body.appendChild(banner);
    }

    function updateOnlineStatus() {
        if (!navigator.onLine) {
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initOfflineDetector();
});

// --- Petugas Preference Storage ---
function setSavedPetugas(name) {
    if (name) localStorage.setItem('last_petugas', name);
}

function getSavedPetugas() {
    return localStorage.getItem('last_petugas') || '';
}

// --- Fetch Helper with Automatic Retry & Friendly Error Parsing ---
async function safeFetchJson(url, options = {}, retries = 2) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const fetchOptions = { redirect: 'follow', ...options };
            if (fetchOptions.method === 'POST' && typeof fetchOptions.body === 'string') {
                fetchOptions.headers = fetchOptions.headers || {};
                if (!fetchOptions.headers['Content-Type']) {
                    fetchOptions.headers['Content-Type'] = 'text/plain;charset=utf-8';
                }
            }
            const response = await fetch(url, fetchOptions);
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (jsonErr) {
                if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                    if (text.includes('ServiceLogin') || text.includes('accounts.google.com')) {
                        throw new Error("Akses Web App Apps Script ditolak. Pastikan 'Who has access' di-set ke 'Anyone'.");
                    }
                    const errMatch = text.match(/class="errorMessage"[^>]*>(.*?)<\/p>/i) || text.match(/<body[^>]*>(.*?)<\/body>/i);
                    const cleanHtmlMsg = errMatch ? errMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    throw new Error(cleanHtmlMsg || "Kendala koneksi respons server Apps Script. Silakan coba klik sekali lagi.");
                }
                throw new Error("Format respons dari server tidak sesuai: " + jsonErr.message);
            }
        } catch (err) {
            lastError = err;
            if (attempt < retries && !err.message.includes('Anyone')) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            } else {
                throw err;
            }
        }
    }
    throw lastError;
}

// --- Date Helpers ---
function getLocalDateISO() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseCustomDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    const str = String(dateStr).trim();
    if (!str) return null;

    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
        const parts = str.split(/[-/]/);
        const dayStr = parts[2].split(' ')[0];
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(dayStr));
    }
    const match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (match) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function getGoogleDriveThumbnail(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    let fileId = null;
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
        fileId = idMatch[1];
    } else {
        const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (dMatch) {
            fileId = dMatch[1];
        }
    }

    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
    }
    return trimmed;
}
