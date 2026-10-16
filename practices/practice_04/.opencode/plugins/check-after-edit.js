// OpenCode 2 lifecycle plugin: runs check.sh after tool execution
export default {
  name: 'check-after-edit',
  version: '1.0.0',
  register(ctx) {
    if (ctx && ctx.tool && typeof ctx.tool.hook === 'function') {
      ctx.tool.hook('execute.after', async (data) => {
        // Runs check.sh runner after edit tools
        const toolName = data?.tool?.name || '';
        if (['write_to_file', 'replace_file_content', 'edit'].includes(toolName)) {
          const { execSync } = await import('child_process');
          try {
            execSync('sh scripts/check.sh', { stdio: 'inherit' });
          } catch (e) {
            console.error('[check-after-edit] Verification runner returned errors');
          }
        }
      });
    }
  },
};
