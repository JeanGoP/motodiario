IF OBJECT_ID(N'[dbo].[pagos]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.pagos', 'installment_number') IS NULL
    ALTER TABLE [dbo].[pagos] ADD [installment_number] int NULL;

  IF COL_LENGTH('dbo.pagos', 'payment_method') IS NULL
    ALTER TABLE [dbo].[pagos] ADD [payment_method] nvarchar(50) NULL;
END
GO

IF OBJECT_ID(N'[dbo].[pagos]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.pagos', 'installment_number') IS NOT NULL
     AND COL_LENGTH('dbo.pagos', 'motorcycle_id') IS NOT NULL
     AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'UQ_pagos_motorcycle_installment'
          AND object_id = OBJECT_ID(N'[dbo].[pagos]')
     )
  BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UQ_pagos_motorcycle_installment]
      ON [dbo].[pagos] ([motorcycle_id], [installment_number])
      WHERE [installment_number] IS NOT NULL;');
  END
END
GO

IF OBJECT_ID(N'[dbo].[payments]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.payments', 'installment_number') IS NULL
    ALTER TABLE [dbo].[payments] ADD [installment_number] int NULL;

  IF COL_LENGTH('dbo.payments', 'payment_method') IS NULL
    ALTER TABLE [dbo].[payments] ADD [payment_method] nvarchar(50) NULL;
END
GO

IF OBJECT_ID(N'[dbo].[payments]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.payments', 'installment_number') IS NOT NULL
     AND COL_LENGTH('dbo.payments', 'motorcycle_id') IS NOT NULL
     AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'UQ_payments_motorcycle_installment'
          AND object_id = OBJECT_ID(N'[dbo].[payments]')
     )
  BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UQ_payments_motorcycle_installment]
      ON [dbo].[payments] ([motorcycle_id], [installment_number])
      WHERE [installment_number] IS NOT NULL;');
  END
END
GO
