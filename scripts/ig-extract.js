// Extractor used against a rendered Instagram post page in an authenticated tab.
// Pairs every <time> with the comment block that contains it, so each comment
// carries its own exact ISO timestamp. Post row is the one authored by the post owner
// with the earliest timestamp.
(() => {
  const rows = [];
  document.querySelectorAll('time').forEach(t => {
    let el = t, hops = 0, host = null;
    while (el && hops < 9) {
      if (el.querySelector && el.querySelector('a[href^="/"]') && el.innerText && el.innerText.length > 3) host = el;
      el = el.parentElement; hops++;
    }
    if (!host) return;
    const a = host.querySelector('a[href^="/"]');
    const user = a ? a.getAttribute('href').replace(/\//g, '') : null;
    let txt = (host.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
    txt = txt.filter(s => s !== user
      && !/^(Reply|See translation|View all|\d+ likes?|\d+ like|Edited|•|Follow|Original audio|AI content)/.test(s)
      && s !== t.innerText);
    rows.push({ user, when: t.getAttribute('datetime'), text: txt.slice(0, 2).join(' ').slice(0, 220) });
  });
  return { url: location.href, rows };
})()
