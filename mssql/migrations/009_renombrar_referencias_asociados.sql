-- Rename client_id -> asociado_id in motorcycles
IF COL_LENGTH('dbo.motorcycles', 'client_id') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.motorcycles.client_id', 'asociado_id', 'COLUMN';
END
GO
IF OBJECT_ID('dbo.FK_motorcycles_client', 'F') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.FK_motorcycles_client', 'FK_motorcycles_asociado', 'OBJECT';
END
GO
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_motorcycles_client' AND object_id = OBJECT_ID('dbo.motorcycles'))
BEGIN
    EXEC sp_rename 'dbo.motorcycles.idx_motorcycles_client', 'idx_motorcycles_asociado', 'INDEX';
END
GO

-- Rename client_id -> asociado_id in payments
IF COL_LENGTH('dbo.payments', 'client_id') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.payments.client_id', 'asociado_id', 'COLUMN';
END
GO
IF OBJECT_ID('dbo.FK_payments_client', 'F') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.FK_payments_client', 'FK_payments_asociado', 'OBJECT';
END
GO
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_payments_client' AND object_id = OBJECT_ID('dbo.payments'))
BEGIN
    EXEC sp_rename 'dbo.payments.idx_payments_client', 'idx_payments_asociado', 'INDEX';
END
GO

-- Rename client_id -> asociado_id in deactivations
IF COL_LENGTH('dbo.deactivations', 'client_id') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.deactivations.client_id', 'asociado_id', 'COLUMN';
END
GO
IF OBJECT_ID('dbo.FK_deactivations_client', 'F') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.FK_deactivations_client', 'FK_deactivations_asociado', 'OBJECT';
END
GO

-- Rename client_id -> asociado_id in notifications
IF COL_LENGTH('dbo.notifications', 'client_id') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.notifications.client_id', 'asociado_id', 'COLUMN';
END
GO
IF OBJECT_ID('dbo.FK_notifications_client', 'F') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.FK_notifications_client', 'FK_notifications_asociado', 'OBJECT';
END
GO
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_notifications_client' AND object_id = OBJECT_ID('dbo.notifications'))
BEGIN
    EXEC sp_rename 'dbo.notifications.idx_notifications_client', 'idx_notifications_asociado', 'INDEX';
END
GO

-- Rename client_id -> asociado_id in daily_status
IF COL_LENGTH('dbo.daily_status', 'client_id') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.daily_status.client_id', 'asociado_id', 'COLUMN';
END
GO
IF OBJECT_ID('dbo.FK_daily_status_client', 'F') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.FK_daily_status_client', 'FK_daily_status_asociado', 'OBJECT';
END
GO
