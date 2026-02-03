export const printReceipt = (data: {
  receipt_number: string;
  payment_date: string;
  amount: number;
  asociado: {
    nombre: string;
    documento: string;
  };
  motorcycle: {
    plate: string;
    brand: string;
    model: string;
  };
}) => {
  const amount = Number(data.amount);
  const companyAmount = amount * 0.3;
  const associateAmount = amount * 0.7;

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
      <title>Recibo ${data.receipt_number}</title>
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
            margin: 1cm;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">MOTODIARIO</h1>
        <p class="subtitle">Recibo de Caja</p>
        <div class="row" style="justify-content: center; margin-top: 10px;">
          <strong>${data.receipt_number}</strong>
        </div>
        <div class="row" style="justify-content: center;">
          <span>${new Date(data.payment_date).toLocaleDateString()}</span>
        </div>
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
        <div class="section-title">Datos de la Moto</div>
        <div class="row">
          <span>Placa:</span>
          <strong>${data.motorcycle.plate}</strong>
        </div>
        <div class="row">
          <span>Marca/Modelo:</span>
          <span>${data.motorcycle.brand} ${data.motorcycle.model}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Detalle del Pago</div>
        <div class="row total-row">
          <span>MONTO TOTAL:</span>
          <span>${formatCurrency(amount)}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Distribución</div>
        <div class="row">
          <span>Empresa (30%):</span>
          <span>${formatCurrency(companyAmount)}</span>
        </div>
        <div class="row">
          <span>Asociado (70%):</span>
          <span>${formatCurrency(associateAmount)}</span>
        </div>
      </div>

      <div class="signatures">
        <div class="signature-line">
          Firma Recibido
        </div>
        <div class="signature-line">
          Firma Entregado
        </div>
      </div>

      <div class="footer">
        <p>¡Gracias por su pago!</p>
      </div>

      <script>
        function doPrint() {
          window.print();
        }
        function doClose() {
          window.close();
        }
        // Auto-print removed to allow preview
      </script>
      <div class="no-print" style="text-align: center; margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-bottom: 1px solid #ddd;">
        <button onclick="doPrint()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #4F46E5; color: white; border: none; border-radius: 5px; margin-right: 10px;">🖨️ Imprimir</button>
        <button onclick="doClose()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #EF4444; color: white; border: none; border-radius: 5px;">❌ Cerrar</button>
      </div>
    </body>
    </html>
  `;

  // Open a larger window (1000x800) to allow better preview, centered on screen
  const width = 1000;
  const height = 800;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  
  const printWindow = window.open('', '_blank', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    alert('Por favor permita las ventanas emergentes para imprimir el recibo.');
  }
};
