# Rollback Plan

This document outlines the rollback procedures for the Yard Qualifier application in case of deployment issues or critical bugs.

## Quick Rollback Checklist

- [ ] Identify the issue and impact scope
- [ ] Communicate with stakeholders
- [ ] Execute appropriate rollback procedure
- [ ] Verify rollback success
- [ ] Monitor system health
- [ ] Document incident and lessons learned

## Rollback Procedures

### 1. Frontend Rollback (Render Static Site)

#### Automatic Rollback
Render automatically keeps previous deployments available for instant rollback.

```bash
# Via Render Dashboard
1. Go to yard-qualifier-web service
2. Click "Rollbacks" tab
3. Select previous successful deployment
4. Click "Rollback to this deploy"
```

#### Manual Rollback
```bash
# Redeploy previous commit
git log --oneline -10  # Find last good commit
git checkout <last-good-commit>
git push origin main --force  # Triggers new deployment
```

**Verification Steps:**
- [ ] Check https://yard-qualifier-web.onrender.com loads
- [ ] Verify map functionality
- [ ] Test search workflow
- [ ] Confirm API connectivity

### 2. API Server Rollback (Render Web Service)

#### Automatic Rollback
```bash
# Via Render Dashboard
1. Go to yard-qualifier-api service
2. Click "Rollbacks" tab
3. Select previous successful deployment
4. Click "Rollback to this deploy"
```

#### Manual Rollback
```bash
# Redeploy previous commit
git checkout <last-good-commit>
git push origin main --force
```

**Verification Steps:**
- [ ] Check https://yard-qualifier-api.onrender.com/api/health
- [ ] Test search endpoint with sample data
- [ ] Verify database connectivity
- [ ] Check CV service integration

### 3. CV Service Rollback (Render Web Service)

#### Automatic Rollback
```bash
# Via Render Dashboard
1. Go to yard-qualifier-cv service
2. Click "Rollbacks" tab
3. Select previous successful deployment
4. Click "Rollback to this deploy"
```

#### Manual Rollback
```bash
# Redeploy previous commit
git checkout <last-good-commit>
git push origin main --force
```

**Verification Steps:**
- [ ] Check https://yard-qualifier-cv.onrender.com/health
- [ ] Test pool detection endpoint
- [ ] Verify YOLO model loading
- [ ] Check cache functionality

### 4. Database Rollback (Supabase)

#### Migration Rollback
```bash
# Connect to Supabase project
supabase link --project-ref <project-ref>

# List migrations
supabase migration list

# Rollback to specific migration
supabase db reset --linked
supabase migration up --to <migration-timestamp>
```

#### Data Rollback
```bash
# Restore from backup (if available)
# Note: This should be done with extreme caution
supabase db dump --linked > backup.sql
# Restore previous backup through Supabase dashboard
```

**Verification Steps:**
- [ ] Check database connectivity
- [ ] Verify schema integrity
- [ ] Test PostGIS functions
- [ ] Confirm RLS policies active

### 5. Edge Functions Rollback (Supabase)

#### Function Rollback
```bash
# Deploy previous version
git checkout <last-good-commit>
supabase functions deploy llm_summarize
```

**Verification Steps:**
- [ ] Test LLM analysis endpoint
- [ ] Verify OpenAI integration
- [ ] Check usage logging
- [ ] Confirm error handling

## Environment-Specific Procedures

### Production Rollback
1. **Immediate Actions:**
   - Set maintenance mode if necessary
   - Notify users via status page
   - Execute rollback procedures above

2. **Communication:**
   - Slack/Teams notification to dev team
   - Email to stakeholders if user-facing
   - Update status page with progress

3. **Post-Rollback:**
   - Monitor error rates and performance
   - Verify all integrations working
   - Document incident in post-mortem

### Staging Rollback
1. Execute same procedures as production
2. Test thoroughly before promoting to production
3. Update CI/CD if needed

## Rollback Decision Matrix

| Issue Type | Severity | Rollback Method | Timeline |
|------------|----------|-----------------|----------|
| Frontend bug | Low | Manual fix | 1-2 hours |
| Frontend crash | High | Automatic rollback | 5 minutes |
| API error | Medium | Automatic rollback | 10 minutes |
| API crash | Critical | Automatic rollback | 2 minutes |
| CV service down | Medium | Automatic rollback | 10 minutes |
| Database issue | Critical | Manual intervention | 30 minutes |
| Security issue | Critical | Immediate rollback | 1 minute |

## Monitoring During Rollback

### Key Metrics to Watch
- **Error Rates**: Should decrease after rollback
- **Response Times**: Should return to baseline
- **User Traffic**: Monitor for user impact
- **Database Performance**: Check query performance
- **External API Calls**: Verify integrations working

### Monitoring Tools
- Render service dashboards
- Supabase dashboard
- Sentry error tracking
- Custom health check endpoints

## Prevention Strategies

### Pre-Deployment
- [ ] Run full test suite
- [ ] Deploy to staging first
- [ ] Perform smoke tests
- [ ] Check database migrations
- [ ] Verify environment variables

### Deployment
- [ ] Deploy during low-traffic hours
- [ ] Monitor metrics during deployment
- [ ] Have rollback plan ready
- [ ] Keep team available for 30 minutes post-deploy

### Post-Deployment
- [ ] Monitor for 1 hour minimum
- [ ] Check error rates and performance
- [ ] Verify user workflows
- [ ] Update documentation if needed

## Emergency Contacts

### Internal Team
- **Lead Developer**: [contact info]
- **DevOps Engineer**: [contact info]
- **Product Manager**: [contact info]

### External Services
- **Render Support**: support@render.com
- **Supabase Support**: support@supabase.com
- **OpenAI Support**: help@openai.com

## Recovery Testing

### Monthly Rollback Drills
1. Schedule rollback drill in staging
2. Practice each rollback procedure
3. Time each procedure
4. Document any issues found
5. Update procedures as needed

### Disaster Recovery
1. **Complete Service Outage:**
   - Activate backup infrastructure
   - Restore from latest backups
   - Communicate with users
   - Investigate root cause

2. **Data Loss Scenario:**
   - Stop all write operations
   - Assess data loss scope
   - Restore from backups
   - Verify data integrity
   - Resume operations gradually

## Post-Incident Actions

### Immediate (0-2 hours)
- [ ] Confirm rollback successful
- [ ] Monitor system stability
- [ ] Communicate resolution to users
- [ ] Begin incident documentation

### Short-term (2-24 hours)
- [ ] Investigate root cause
- [ ] Fix underlying issue
- [ ] Test fix in staging
- [ ] Plan re-deployment

### Long-term (1-7 days)
- [ ] Conduct post-mortem meeting
- [ ] Update procedures based on learnings
- [ ] Implement additional monitoring
- [ ] Share learnings with team

## Documentation Updates

After any rollback:
1. Update this document with lessons learned
2. Revise procedures that didn't work well
3. Add new monitoring or alerting if needed
4. Share updates with the team

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2024-01-01 | Initial rollback plan | System |

---

**Remember**: When in doubt, rollback first and investigate later. User experience is the top priority.