export function buildPipelineSections(response) {
  const validation = response && response.validation;
  const explanation = response && response.explanation;
  return [
    {
      id: 'validation',
      title: 'Validation',
      lines: validation ? [`Total: ${validation.summary ? validation.summary.total : 0}`] : ['No validation yet'],
    },
    {
      id: 'explanation',
      title: 'Explanation',
      lines: explanation ? Object.values(explanation).filter(Boolean) : ['No explanation yet'],
    },
  ];
}
