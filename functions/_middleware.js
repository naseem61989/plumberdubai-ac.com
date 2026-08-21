// ============================================================
// TRACKING EVENTS — GA4 + Google Ads conversions + GCLID capture
// Phone, WhatsApp, Form: har ek GA4 event AUR Google Ads conversion
// dono fire karta hai. Ads labels khaali hon to sirf GA4 chalta hai.
//
// AHEM (Aug 2026): Google Ads conversions ab SIRF yahan se fire hoti
// hain. Website builder ki Mode 1 pages pehle khud bhi call/WhatsApp
// conversion bhejti thin jabke yahan se wahi clicks GA4 events bankar
// Ads me import hote the — har call DO baar ginti thi. Ab ek hi jagah.
// GA4 ko Google Ads se LINK rehne dein, lekin GA4 events ko Ads me
// IMPORT mat karein — warna double counting wapas aa jayegi.
// ============================================================
const TRACKING_EVENTS = `<script>
document.addEventListener('DOMContentLoaded', function() {
  var AW_ID = "AW-10833903738";
  var LBL = { phone: "iFVsCInYoOUcEPqAga4o", whatsapp: "40o7CIzYoOUcEPqAga4o", form: "jJDfCI_YoOUcEPqAga4o" };

  function safe_gtag() {
    if (typeof gtag === 'function') {
      gtag.apply(null, arguments);
    }
  }

  // -- GCLID CAPTURE (offline conversion upload ke liye) --
  // URL se gclid uthao, 90 din store karo (Google ka click window),
  // aur har form me hidden field bana do. Lead aane par gclid saath
  // aayega — usi se baad me 'ye lead job bani' Ads ko bheja ja sakta hai.
  var P = new URLSearchParams(window.location.search);
  var gclid = P.get('gclid') || P.get('wbraid') || P.get('gbraid') || '';
  try {
    if (gclid) {
      localStorage.setItem('cap_gclid', JSON.stringify({ v: gclid, t: Date.now() }));
    } else {
      var st = JSON.parse(localStorage.getItem('cap_gclid') || 'null');
      if (st && st.v && (Date.now() - st.t) < 7776000000) { gclid = st.v; }
    }
  } catch (e) {}

  if (gclid) {
    document.querySelectorAll('form').forEach(function(form) {
      if (form.querySelector('input[name="gclid"]')) return;
      var h = document.createElement('input');
      h.type = 'hidden'; h.name = 'gclid'; h.value = gclid;
      form.appendChild(h);
    });
  }

  // -- ek action = ek GA4 event + ek Ads conversion --
  // transport_type 'beacon': form submit ke baad page navigate ho jata
  // hai aur normal request beech me mar jati hai — beacon bach jata hai.
  function track(ga4Name, lbl, params) {
    safe_gtag('event', ga4Name, params);
    if (AW_ID && lbl) {
      safe_gtag('event', 'conversion', {
        send_to: AW_ID + '/' + lbl,
        transport_type: 'beacon'
      });
    }
  }

  // 1. PHONE CLICK
  document.querySelectorAll('a[href^="tel:"]').forEach(function(el) {
    el.addEventListener('click', function() {
      track('phone_call_click', LBL.phone, {
        phone_number: el.getAttribute('href'),
        page_location: window.location.href
      });
    });
  });

  // 2. WHATSAPP CLICK
  document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]').forEach(function(el) {
    el.addEventListener('click', function() {
      track('whatsapp_click', LBL.whatsapp, {
        page_location: window.location.href
      });
    });
  });

  // 3. FORM SUBMIT
  document.querySelectorAll('form').forEach(function(form) {
    form.addEventListener('submit', function() {
      // Fraud tracker har form me ek chhupa honeypot (.ftv11-hp) daalta
      // hai. Bot ne wo bhar diya = spam lead. GA4 me rehne do (analytics
      // ke liye), lekin Google Ads conversion mat bhejo — warna Smart
      // Bidding bot ke form-spam se seekhegi.
      var hp = form.querySelector('.ftv11-hp');
      var botFill = !!(hp && hp.value !== '');
      track('form_submit', botFill ? '' : LBL.form, {
        form_id: form.id || form.className || 'contact_form',
        page_location: window.location.href,
        bot_suspected: botFill ? 1 : 0
      });
    });
  });
});
</script>`;

// EEA + UK + Switzerland. Sirf in mulkon ke visitors ko consent banner
// dikhta hai aur unhi par Consent Mode v2 ka 'denied' default lagta hai.
// Gulf/baqi duniya ke liye consent granted hi rehta hai — warna har
// client ki conversions bina wajah band ho jatin.
const EU_COUNTRIES = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB","CH"];

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  // ============================================================
  // CANONICAL URL   <-- PER-CLIENT: sirf CANONICAL_HOST change karo
  // ============================================================
  const CANONICAL_HOST = "https://plumberdubai-ac.com";
  const url = new URL(context.request.url);
  const canonicalUrl = CANONICAL_HOST + url.pathname;
  const CANONICAL = `<link rel="canonical" href="${canonicalUrl}">`;

  // ============================================================
  // EDGE IP CAPTURE (Unknown IP ka fix)
  // CF-Connecting-IP Cloudflare khud set karta hai — 0ms, fake nahi ho sakta.
  // Ye 2 lines har site pe bilkul same rehti hain.
  // ============================================================
  const clientIP  = String(context.request.headers.get("CF-Connecting-IP") || "Unknown").replace(/[^A-Za-z0-9_.:\-]/g, "");
  const ipCountry = String(context.request.headers.get("CF-IPCountry") || "").replace(/[^A-Za-z0-9_.:\-]/g, "");

  // ============================================================
  // CONSENT MODE v2 — sirf EEA/UK/CH visitors ke liye
  // Ye har tag se PEHLE jata hai: 'default' ke baad hi gtag.js load ho,
  // warna default ka koi asar nahi hota. Banner (cookie-consent.js)
  // window._ccRequired dekh kar dikhta hai aur Accept par 'update' bhejta hai.
  // ============================================================
  const needsConsent = EU_COUNTRIES.indexOf(ipCountry) !== -1;
  const CONSENT = needsConsent
    ? `<script>window._ccRequired=true;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});</script>`
    : `<script>window._ccRequired=false;</script>`;

  // ============================================================
  // GA4 TRACKING   <-- PER-CLIENT: agar GA4 ID alag hai to badlo
  // ============================================================
  const GA4 = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-L3HHN00DRC"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-L3HHN00DRC');</script>`;

  // ============================================================
  // GOOGLE ADS CONVERSION TAG
  // gtag.js GA4 wale block se already load ho chuki hai — yahan sirf
  // AW account ka config chahiye. Labels TRACKING_EVENTS me hain.
  // ============================================================
  const ADS = `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('config','AW-10833903738');</script>`;

  // ============================================================
  // CLICK FRAUD TRACKER (ClickAdsProtector)
  //   <-- PER-CLIENT: sirf _ftSite aur _ftKey change karo
  //   window._ftIP + window._ftCountry ab tracker se PEHLE inject hote hain.
  //   Tracker @main se aata hai — repo update = sab sites auto-update.
  // ============================================================
  const TRACKER = `<script>window._ftSite="Au bakr water pump repair";window._ftKey="CF-PLUMBERA-2026-atxmnh";window._ftIP="${clientIP}";window._ftCountry="${ipCountry}";</script><script src="https://cdn.jsdelivr.net/gh/clickadsprotector/fraud-tracker@main/tracker.js"></script>`;

  return new HTMLRewriter()
    .on("link[rel='canonical']", {
      element(el) {
        el.remove();
      },
    })
    .on("head", {
      element(el) {
        el.append(CANONICAL, { html: true });
        el.append(CONSENT, { html: true });
        el.append(GA4, { html: true });
        if (ADS) el.append(ADS, { html: true });
        el.append(TRACKER, { html: true });
      },
    })
    .on("body", {
      element(el) {
        el.append(TRACKING_EVENTS, { html: true });
      },
    })
    .transform(response);
}
