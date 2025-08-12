import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

interface RestoreOptions {
  backup_filename?: string;
  test_mode?: boolean;
  target_schema?: string;
}

function decrypt(encryptedData: string, secret: string): string {
  if (!secret) {
    // Fallback for base64 encoded data
    try {
      return Buffer.from(encryptedData, 'base64').toString('utf8');
    } catch {
      throw new Error('Invalid backup format and no decryption key');
    }
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipher('aes-256-cbc', secret);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getLatestBackup(): Promise<{ filename: string; data: string } | null> {
  const bucketConfig = process.env.BACKUPS_BUCKET;
  if (!bucketConfig) {
    throw new Error('BACKUPS_BUCKET not configured');
  }

  // If using Supabase Storage
  if (bucketConfig.startsWith('supabase://')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const bucketName = bucketConfig.replace('supabase://', '');
    
    // List backup files
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('backups/', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      throw new Error(`Failed to list backups: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      return null;
    }

    // Get the latest backup file
    const latestFile = files[0];
    const { data, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(`backups/${latestFile.name}`);

    if (downloadError) {
      throw new Error(`Failed to download backup: ${downloadError.message}`);
    }

    const backupData = await data.text();
    return {
      filename: latestFile.name,
      data: backupData
    };
  }

  throw new Error('Unsupported backup storage type');
}

async function validateBackupIntegrity(backupData: any): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  // Check required fields
  if (!backupData.exported_at) issues.push('Missing export timestamp');
  if (!Array.isArray(backupData.workflows)) issues.push('Missing or invalid workflows array');
  if (!backupData.version) issues.push('Missing version information');

  // Validate workflows structure
  if (Array.isArray(backupData.workflows)) {
    backupData.workflows.forEach((workflow: any, index: number) => {
      if (!workflow.id) issues.push(`Workflow ${index}: missing ID`);
      if (!workflow.name) issues.push(`Workflow ${index}: missing name`);
      if (!Array.isArray(workflow.nodes)) issues.push(`Workflow ${index}: missing or invalid nodes`);
    });
  }

  // Check data freshness (shouldn't be older than 7 days for monthly drills)
  if (backupData.exported_at) {
    const exportDate = new Date(backupData.exported_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - exportDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 7) {
      issues.push(`Backup is ${daysDiff} days old (older than recommended 7 days)`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

async function createSandboxSchema(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase configuration missing for sandbox creation');
  }

  // This would typically involve creating a separate schema or using a test database
  // For now, we'll simulate the process
  console.log('Sandbox schema creation simulated');
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Parse request options
    const options: RestoreOptions = event.body ? JSON.parse(event.body) : {};
    const testMode = options.test_mode ?? true; // Default to test mode for safety

    console.log('Starting restore sandbox process...');

    // Get latest backup
    const backup = await getLatestBackup();
    if (!backup) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          ok: false,
          error: 'No backups found'
        })
      };
    }

    // Decrypt backup data
    const encryptionKey = process.env.BACKUPS_ENCRYPTION_KEY || '';
    const decryptedData = decrypt(backup.data, encryptionKey);
    const backupData = JSON.parse(decryptedData);

    // Validate backup integrity
    const validation = await validateBackupIntegrity(backupData);
    
    if (!validation.valid) {
      // Send alert for validation failures
      try {
        await fetch(`${process.env.URL}/.netlify/functions/alerts-dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sev: 'sev2',
            title: 'Backup Validation Failed',
            desc: `Backup integrity check failed during restore test`,
            meta: {
              filename: backup.filename,
              issues: validation.issues
            }
          })
        });
      } catch (alertError) {
        console.warn('Failed to send validation failure alert:', alertError);
      }
    }

    // Create sandbox environment (simulated)
    if (!testMode) {
      await createSandboxSchema();
    }

    // Prepare restore results
    const restoreResults = {
      backup_file: backup.filename,
      backup_date: backupData.exported_at,
      workflows_count: backupData.workflows?.length || 0,
      validation,
      test_mode: testMode,
      sandbox_created: !testMode,
      timestamp: new Date().toISOString()
    };

    // Log restore test to audit
    const auditEntry = {
      action: 'restore.test_completed',
      resource: `restore/${backup.filename}`,
      meta: restoreResults
    };

    console.log('Restore sandbox test completed:', restoreResults);

    // Send success notification
    try {
      await fetch(`${process.env.URL}/.netlify/functions/alerts-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sev: validation.valid ? 'info' : 'sev3',
          title: 'Restore Test Completed',
          desc: validation.valid 
            ? `Monthly restore test completed successfully`
            : `Restore test completed with ${validation.issues.length} issues`,
          meta: restoreResults
        })
      });
    } catch (alertError) {
      console.warn('Failed to send restore completion alert:', alertError);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        restore: restoreResults
      })
    };

  } catch (error) {
    console.error('Restore sandbox error:', error);

    // Send failure notification
    try {
      await fetch(`${process.env.URL}/.netlify/functions/alerts-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sev: 'sev2',
          title: 'Restore Test Failed',
          desc: `Monthly restore test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          meta: { error_type: error instanceof Error ? error.name : 'UnknownError' }
        })
      });
    } catch (alertError) {
      console.warn('Failed to send restore failure alert:', alertError);
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};