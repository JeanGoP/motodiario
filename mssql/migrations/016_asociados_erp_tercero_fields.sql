IF COL_LENGTH('asociados', 'digverificacion') IS NULL
BEGIN
  ALTER TABLE asociados ADD digverificacion NVARCHAR(16) NULL;
END;

IF COL_LENGTH('asociados', 'fechaexpedicion') IS NULL
BEGIN
  ALTER TABLE asociados ADD fechaexpedicion DATE NULL;
END;

IF COL_LENGTH('asociados', 'fechanacimiento') IS NULL
BEGIN
  ALTER TABLE asociados ADD fechanacimiento DATE NULL;
END;

IF COL_LENGTH('asociados', 'municipio_dane') IS NULL
BEGIN
  ALTER TABLE asociados ADD municipio_dane NVARCHAR(16) NULL;
END;

IF COL_LENGTH('asociados', 'nombrecontacto') IS NULL
BEGIN
  ALTER TABLE asociados ADD nombrecontacto NVARCHAR(256) NULL;
END;

IF COL_LENGTH('asociados', 'telefonocontacto') IS NULL
BEGIN
  ALTER TABLE asociados ADD telefonocontacto NVARCHAR(64) NULL;
END;

IF COL_LENGTH('asociados', 'emailcontacto') IS NULL
BEGIN
  ALTER TABLE asociados ADD emailcontacto NVARCHAR(256) NULL;
END;
