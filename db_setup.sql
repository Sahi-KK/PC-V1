-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create expense_splits table
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_owed DECIMAL(10, 2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(expense_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- 4. Policies for expenses
CREATE POLICY "Users can view all expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Users can insert their own expenses" ON expenses FOR INSERT WITH CHECK (auth.uid() = paid_by);

-- 5. Policies for expense_splits
CREATE POLICY "Users can view all splits" ON expense_splits FOR SELECT USING (true);
CREATE POLICY "Creators can insert splits" ON expense_splits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND paid_by = auth.uid())
);
CREATE POLICY "Creators can update splits" ON expense_splits FOR UPDATE USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND paid_by = auth.uid())
);

-- 6. Alter user_profiles to support push subscriptions (for PWA)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS push_subscriptions JSONB DEFAULT '[]'::jsonb;
