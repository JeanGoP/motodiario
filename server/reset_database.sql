BEGIN TRY
  BEGIN TRANSACTION;

  DELETE FROM distribuciones_pagos;
  DELETE FROM pagos;
  DELETE FROM recibos_caja;
  DELETE FROM desactivaciones;
  DELETE FROM notificaciones;
  DELETE FROM dias_gracia_motos;
  DELETE FROM motos;
  DELETE FROM dias_gracia_asociados;
  DELETE FROM asociados;
  DELETE FROM centros_costo;
  DELETE FROM usuarios;
  DELETE FROM empresas WHERE codigo <> N'DEFAULT';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH
