$headers = @{'Accept' = 'application/vnd.github.v3+json'}
try {
    # Get the latest run for v2.0.42 tag
    $runs = Invoke-RestMethod 'https://api.github.com/repos/akawazak/akaReader/actions/runs?per_page=5' -Headers $headers
    $latest = $runs.workflow_runs[0]
    Write-Host "Latest: $($latest.name) | $($latest.status) | $($latest.conclusion)"
    Write-Host "Branch: $($latest.head_branch)"

    if ($latest.status -ne 'completed') {
        # Get jobs for this run
        $runId = $latest.id
        $jobs = Invoke-RestMethod "https://api.github.com/repos/akawazak/akaReader/actions/runs/$runId/jobs" -Headers $headers
        Write-Host ""
        Write-Host "Jobs:"
        foreach ($job in $jobs.workflow_jobs) {
            Write-Host "  $($job.name) | $($job.status) | $($job.conclusion)"
        }
    } else {
        Write-Host "Conclusion: $($latest.conclusion)"
        if ($latest.conclusion -eq 'success') {
            Write-Host "STATUS: PASS"
        } else {
            Write-Host "STATUS: FAIL"
        }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}