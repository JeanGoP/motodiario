BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @defaultEmpresaId uniqueidentifier;
  SELECT @defaultEmpresaId = id FROM dbo.empresas WHERE codigo = N'DEFAULT';

  IF OBJECT_ID(N'dbo.contable_asiento_lineas', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.contable_asiento_lineas', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.contable_asiento_lineas WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.contable_asiento_lineas;
  END

  IF OBJECT_ID(N'dbo.contable_asientos', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.contable_asientos', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.contable_asientos WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.contable_asientos;
  END

  IF OBJECT_ID(N'dbo.contable_regla_lineas', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.contable_regla_lineas', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.contable_regla_lineas WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.contable_regla_lineas;
  END

  IF OBJECT_ID(N'dbo.contable_reglas_versiones', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.contable_reglas_versiones', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.contable_reglas_versiones WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.contable_reglas_versiones;
  END

  IF OBJECT_ID(N'dbo.contable_cuentas', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.contable_cuentas', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.contable_cuentas WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.contable_cuentas;
  END

  IF OBJECT_ID(N'dbo.distribuciones_pagos', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.distribuciones_pagos', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.distribuciones_pagos WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.distribuciones_pagos;
  END

  IF OBJECT_ID(N'dbo.pagos', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.pagos', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.pagos WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.pagos;
  END

  IF OBJECT_ID(N'dbo.recibos_caja', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.recibos_caja', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.recibos_caja WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.recibos_caja;
  END

  IF OBJECT_ID(N'dbo.desactivaciones', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.desactivaciones', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.desactivaciones WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.desactivaciones;
  END

  IF OBJECT_ID(N'dbo.notificaciones', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.notificaciones', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.notificaciones WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.notificaciones;
  END

  IF OBJECT_ID(N'dbo.dias_gracia_motos', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.dias_gracia_motos', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.dias_gracia_motos WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.dias_gracia_motos;
  END

  IF OBJECT_ID(N'dbo.motos', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.motos', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.motos WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.motos;
  END

  IF OBJECT_ID(N'dbo.dias_gracia_asociados', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.dias_gracia_asociados', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.dias_gracia_asociados WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.dias_gracia_asociados;
  END

  IF OBJECT_ID(N'dbo.asociados', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.asociados', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.asociados WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.asociados;
  END

  IF OBJECT_ID(N'dbo.centros_costo', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.centros_costo', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.centros_costo WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.centros_costo;
  END

  IF OBJECT_ID(N'dbo.usuarios', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.usuarios', 'empresa_id') IS NOT NULL AND @defaultEmpresaId IS NOT NULL
      DELETE FROM dbo.usuarios WHERE empresa_id <> @defaultEmpresaId;
    ELSE
      DELETE FROM dbo.usuarios;
  END

  IF OBJECT_ID(N'dbo.empresas', N'U') IS NOT NULL
    DELETE FROM dbo.empresas WHERE codigo <> N'DEFAULT';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH
