export const printCashReceipt = (data: {
  receipt_number: string; // Puede ser el ID corto o un consecutivo si lo tuviéramos
  date: string;
  amount: number;
  concept: string;
  observations?: string;
  asociado: {
    nombre: string;
    documento: string;
  };
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Recibo de Caja</title>
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 14px;
          line-height: 1.4;
          color: #000;
          max-width: 80mm; /* Standard receipt width */
          margin: 0 auto;
          padding: 10px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .title {
          font-size: 18px;
          font-weight: bold;
          margin: 0;
        }
        .subtitle {
          font-size: 14px;
          margin: 5px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
        }
        .section {
          margin: 15px 0;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .section-title {
          font-weight: bold;
          margin-bottom: 5px;
          text-transform: uppercase;
          font-size: 12px;
        }
        .total-row {
          font-weight: bold;
          font-size: 16px;
          margin-top: 10px;
          text-align: right;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
        }
        .signatures {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
        }
        .signature-line {
          border-top: 1px solid #000;
          width: 45%;
          text-align: center;
          padding-top: 5px;
        }
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">MOTODIARIO</h1>
        <div class="subtitle">RECIBO DE CAJA</div>
        <div class="subtitle">${data.date}</div>
      </div>

      <div class="section">
        <div class="section-title">Datos del Asociado</div>
        <div class="row">
          <span>Nombre:</span>
          <span>${data.asociado.nombre}</span>
        </div>
        <div class="row">
          <span>Documento:</span>
          <span>${data.asociado.documento}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Detalle del Recaudo</div>
        <div class="row">
          <span>Concepto:</span>
          <span>${data.concept}</span>
        </div>
        ${data.observations ? `
        <div class="row">
          <span>Obs:</span>
          <span>${data.observations}</span>
        </div>
        ` : ''}
        <div class="row total-row">
          <span>TOTAL RECIBIDO:</span>
          <span>${formatCurrency(data.amount)}</span>
        </div>
      </div>

      <div class="signatures">
        <div class="signature-line">
          Entregado
        </div>
        <div class="signature-line">
          Recibido
        </div>
      </div>

      <div class="footer">
        <p>Gracias por su pago</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          }
        }
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};
