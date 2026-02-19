-- SQL para adicionar a coluna de formato de data de entrega na tabela de projetos
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_format TEXT DEFAULT 'month';
