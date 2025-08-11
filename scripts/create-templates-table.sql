-- Templates Table Migration for RP9 Portal
-- Creates the templates table with all necessary fields for the marketplace

-- Drop table if it exists (for clean recreation)
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.template_installs CASCADE;
DROP TABLE IF EXISTS public.template_purchases CASCADE;

-- Create templates table
CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    subcategory text,
    workflow_json jsonb NOT NULL,
    icon_url text,
    preview_images text[] DEFAULT '{}',
    tags text[] DEFAULT '{}',
    difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
    estimated_time integer DEFAULT 30, -- minutes
    price numeric(10,2) DEFAULT 0.00,
    install_count integer DEFAULT 0,
    rating numeric(3,2) DEFAULT 0.00,
    is_featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    author_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create template installs table (tracks who installed what)
CREATE TABLE public.template_installs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    workflow_id text, -- n8n workflow ID after installation
    workflow_name text, -- name in n8n
    installed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb DEFAULT '{}',
    UNIQUE(tenant_id, template_id, workflow_id)
);

-- Create template purchases table (for paid templates)
CREATE TABLE public.template_purchases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    stripe_payment_intent_id text,
    amount_paid numeric(10,2) NOT NULL,
    purchased_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb DEFAULT '{}',
    UNIQUE(tenant_id, template_id)
);

-- Create indexes for better performance
CREATE INDEX idx_templates_category ON public.templates(category);
CREATE INDEX idx_templates_subcategory ON public.templates(subcategory);
CREATE INDEX idx_templates_difficulty ON public.templates(difficulty);
CREATE INDEX idx_templates_price ON public.templates(price);
CREATE INDEX idx_templates_featured ON public.templates(is_featured) WHERE is_featured = true;
CREATE INDEX idx_templates_active ON public.templates(is_active) WHERE is_active = true;
CREATE INDEX idx_templates_tags ON public.templates USING gin(tags);
CREATE INDEX idx_templates_search ON public.templates USING gin(to_tsvector('english', name || ' ' || description));

CREATE INDEX idx_template_installs_tenant ON public.template_installs(tenant_id);
CREATE INDEX idx_template_installs_template ON public.template_installs(template_id);
CREATE INDEX idx_template_installs_date ON public.template_installs(installed_at);

CREATE INDEX idx_template_purchases_tenant ON public.template_purchases(tenant_id);
CREATE INDEX idx_template_purchases_template ON public.template_purchases(template_id);

-- Create updated_at trigger for templates
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER set_updated_at_templates
    BEFORE UPDATE ON public.templates
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates (public read, authenticated write)
CREATE POLICY "Templates are viewable by everyone" 
ON public.templates FOR SELECT 
USING (is_active = true);

CREATE POLICY "Authenticated users can insert templates" 
ON public.templates FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update their own templates" 
ON public.templates FOR UPDATE 
TO authenticated 
USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own templates" 
ON public.templates FOR DELETE 
TO authenticated 
USING (auth.uid() = author_id);

-- RLS Policies for template installs (tenant-specific)
CREATE POLICY "Users can view their tenant's installs" 
ON public.template_installs FOR SELECT 
TO authenticated 
USING (
    tenant_id IN (
        SELECT id FROM public.tenants 
        WHERE owner_user_id = auth.uid() 
        OR id = auth.jwt() ->> 'tenant_id'::text
    )
);

CREATE POLICY "Users can insert installs for their tenant" 
ON public.template_installs FOR INSERT 
TO authenticated 
WITH CHECK (
    tenant_id IN (
        SELECT id FROM public.tenants 
        WHERE owner_user_id = auth.uid()
        OR id = auth.jwt() ->> 'tenant_id'::text
    )
);

-- RLS Policies for template purchases (tenant-specific)
CREATE POLICY "Users can view their tenant's purchases" 
ON public.template_purchases FOR SELECT 
TO authenticated 
USING (
    tenant_id IN (
        SELECT id FROM public.tenants 
        WHERE owner_user_id = auth.uid()
        OR id = auth.jwt() ->> 'tenant_id'::text
    )
);

CREATE POLICY "Users can insert purchases for their tenant" 
ON public.template_purchases FOR INSERT 
TO authenticated 
WITH CHECK (
    tenant_id IN (
        SELECT id FROM public.tenants 
        WHERE owner_user_id = auth.uid()
        OR id = auth.jwt() ->> 'tenant_id'::text
    )
);

-- Create view for template analytics
CREATE OR REPLACE VIEW public.template_analytics AS
SELECT 
    t.id,
    t.name,
    t.category,
    t.subcategory,
    t.install_count,
    t.rating,
    t.price,
    COUNT(ti.id) as actual_installs,
    COUNT(tp.id) as purchases,
    SUM(tp.amount_paid) as total_revenue,
    t.created_at,
    t.updated_at
FROM public.templates t
LEFT JOIN public.template_installs ti ON t.id = ti.template_id
LEFT JOIN public.template_purchases tp ON t.id = tp.template_id
WHERE t.is_active = true
GROUP BY t.id, t.name, t.category, t.subcategory, t.install_count, t.rating, t.price, t.created_at, t.updated_at
ORDER BY t.install_count DESC, t.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.templates TO anon;
GRANT ALL ON public.templates TO authenticated;
GRANT ALL ON public.template_installs TO authenticated;
GRANT ALL ON public.template_purchases TO authenticated;
GRANT SELECT ON public.template_analytics TO authenticated;

-- Insert sample data for testing (optional)
COMMENT ON TABLE public.templates IS 'n8n workflow templates for the marketplace';
COMMENT ON TABLE public.template_installs IS 'Track template installations per tenant';
COMMENT ON TABLE public.template_purchases IS 'Track template purchases for paid templates';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Templates tables created successfully!';
    RAISE NOTICE 'You can now run: npm run populate-templates';
END $$;