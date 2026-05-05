IF OBJECT_ID(N'[dbo].[cartera_saldos]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[cartera_saldos] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [motorcycle_id] uniqueidentifier NOT NULL,
    [asociado_id] uniqueidentifier NOT NULL,
    [cuota_num] int NOT NULL,
    [cuota_fecha] date NOT NULL,
    [valor_cuota] decimal(10,2) NOT NULL,
    [pagado] decimal(10,2) NOT NULL DEFAULT 0,
    [saldo] decimal(10,2) NOT NULL DEFAULT 0,
    [estado] nvarchar(20) NOT NULL DEFAULT N'PENDIENTE',
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [actualizado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_cartera_saldos] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_cartera_saldos_empresa_moto_cuota] UNIQUE ([empresa_id], [motorcycle_id], [cuota_num])
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cartera_saldos_empresa_fecha' AND object_id = OBJECT_ID(N'[dbo].[cartera_saldos]'))
BEGIN
  CREATE INDEX [idx_cartera_saldos_empresa_fecha]
  ON [dbo].[cartera_saldos] ([empresa_id], [cuota_fecha] DESC)
  INCLUDE ([motorcycle_id], [asociado_id], [cuota_num], [saldo], [estado]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cartera_saldos_empresa_asociado' AND object_id = OBJECT_ID(N'[dbo].[cartera_saldos]'))
BEGIN
  CREATE INDEX [idx_cartera_saldos_empresa_asociado]
  ON [dbo].[cartera_saldos] ([empresa_id], [asociado_id]);
END
GO

IF OBJECT_ID(N'[dbo].[cartera_saldos]', N'U') IS NOT NULL
BEGIN
  IF OBJECT_ID(N'[dbo].[empresas]', N'U') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cartera_saldos_empresa')
  BEGIN
    ALTER TABLE dbo.cartera_saldos
      ADD CONSTRAINT FK_cartera_saldos_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
  END

  IF OBJECT_ID(N'[dbo].[motos]', N'U') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cartera_saldos_moto')
  BEGIN
    ALTER TABLE dbo.cartera_saldos
      ADD CONSTRAINT FK_cartera_saldos_moto FOREIGN KEY (motorcycle_id) REFERENCES dbo.motos(id);
  END

  IF OBJECT_ID(N'[dbo].[asociados]', N'U') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cartera_saldos_asociado')
  BEGIN
    ALTER TABLE dbo.cartera_saldos
      ADD CONSTRAINT FK_cartera_saldos_asociado FOREIGN KEY (asociado_id) REFERENCES dbo.asociados(id);
  END
END
GO
