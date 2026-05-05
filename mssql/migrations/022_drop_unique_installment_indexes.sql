IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UQ_pagos_motorcycle_installment'
    AND object_id = OBJECT_ID(N'[dbo].[pagos]')
)
BEGIN
  DROP INDEX [UQ_pagos_motorcycle_installment] ON [dbo].[pagos];
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UQ_payments_motorcycle_installment'
    AND object_id = OBJECT_ID(N'[dbo].[payments]')
)
BEGIN
  DROP INDEX [UQ_payments_motorcycle_installment] ON [dbo].[payments];
END
GO
