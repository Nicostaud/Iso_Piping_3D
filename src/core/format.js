/** Number and HTML formatting helpers. */
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=(v,d=0)=>v.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
export const fa=v=>String(Math.round(v*10)/10);
