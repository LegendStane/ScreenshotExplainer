if (typeof renderMathInElement === 'function') {
  renderMathInElement(document.body, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false,
    splitAware: true
  });
} else {
  console.error('renderMathInElement is not loaded!');
}
