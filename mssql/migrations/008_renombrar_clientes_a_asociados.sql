-- Rename table clients -> asociados
IF OBJECT_ID(N'dbo.clientes', N'U') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.clientes', 'asociados';
END
GO

-- Rename table dias_gracia_clientes -> dias_gracia_asociados
IF OBJECT_ID(N'dbo.dias_gracia_clientes', N'U') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.dias_gracia_clientes', 'dias_gracia_asociados';
END
GO

-- Rename column cliente_id -> asociado_id in dias_gracia_asociados
IF COL_LENGTH('dbo.dias_gracia_asociados', 'cliente_id') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.dias_gracia_asociados.cliente_id', 'asociado_id', 'COLUMN';
END
GO

-- Rename Constraints/Indexes for asociados table
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_clientes_documento' AND type = 'UQ')
    EXEC sp_rename 'UQ_clientes_documento', 'UQ_asociados_documento';
GO
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CK_clientes_dias_gracia' AND type = 'C')
    EXEC sp_rename 'CK_clientes_dias_gracia', 'CK_asociados_dias_gracia';
GO
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'FK_clientes_centro_costo' AND type = 'F')
    EXEC sp_rename 'FK_clientes_centro_costo', 'FK_asociados_centro_costo';
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_clientes_centro_costo' AND object_id = OBJECT_ID(N'dbo.asociados'))
    EXEC sp_rename 'dbo.asociados.idx_clientes_centro_costo', 'idx_asociados_centro_costo', 'INDEX';
GO

-- Rename Constraints/Indexes for dias_gracia_asociados table
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'FK_dgc_cliente' AND type = 'F')
    EXEC sp_rename 'FK_dgc_cliente', 'FK_dga_asociado';
GO
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CK_dgc_mes' AND type = 'C')
    EXEC sp_rename 'CK_dgc_mes', 'CK_dga_mes';
GO
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CK_dgc_dia' AND type = 'C')
    EXEC sp_rename 'CK_dgc_dia', 'CK_dga_dia';
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_dgc_cliente_mes_dia' AND object_id = OBJECT_ID(N'dbo.dias_gracia_asociados'))
    EXEC sp_rename 'dbo.dias_gracia_asociados.UQ_dgc_cliente_mes_dia', 'UQ_dga_asociado_mes_dia', 'INDEX';
GO
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'PK_dias_gracia_clientes' AND type = 'PK')
    EXEC sp_rename 'PK_dias_gracia_clientes', 'PK_dias_gracia_asociados';
GO
