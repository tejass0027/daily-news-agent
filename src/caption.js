function plain(title) {
  return title.replace(/\*/g, '');
}

export function buildInstagramCaption(stories, dateSub, handle) {
  const lines = stories.map((s, i) => `${i + 1}. [${s.tag}] ${plain(s.title)}`);
  return [
    `Today's Daily Brief — ${dateSub}`,
    '',
    ...lines,
    '',
    `Follow ${handle} for your daily 60-second news brief 🌍`,
    '',
    '#news #dailynews #worldnews #india #newsupdate',
  ].join('\n');
}

export function buildTwitterText(stories, dateSub) {
  const headlines = stories.map(s => plain(s.title));
  let text = `Today's Daily Brief — ${dateSub}\n\n`;
  for (const h of headlines) {
    const line = `• ${h}\n`;
    if ((text + line).length > 250) break;
    text += line;
  }
  text += '\n#news #worldnews';
  return text.length > 280 ? text.slice(0, 277) + '…' : text;
}
