export const businessConfig = {
  // Cálculo de KERF, quanto de espaço temos que compensar pela grossura do feixe
  kerf: 0.01,
  // Fixando em % quanto de tolerância a quebra já calculamos
  materialWastePercent: 10,
  // Fixando valor mínimo
  minimumPrice: 60,
  // Senha dos ZIP's gerados
  zipPassword: '@Imprima1234',
  // Moeda vigente
  currency: 'BRL',
  // Especificando grossuras permitidas e o valor por m²
  acrylic: [
    { thickness: 2, pricePerSquareMeter: 380 },
    { thickness: 3, pricePerSquareMeter: 380 },
    { thickness: 4, pricePerSquareMeter: 680 },
    { thickness: 5, pricePerSquareMeter: 750 },
    { thickness: 6, pricePerSquareMeter: 780 },
    { thickness: 8, pricePerSquareMeter: 850 },
    { thickness: 10, pricePerSquareMeter: 880 }
  ]
};
