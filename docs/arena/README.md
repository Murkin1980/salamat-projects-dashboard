# Arena handoff index

Arena is an external coder. Murat passes the short instruction to Arena; Arena
then reads the complete task packet from this repository.

Run these packets in order and in separate Arena sessions:

1. `CP18_POST_MERGE_CLOSEOUT.md`
2. `CP19_PORTFOLIO_COVERAGE_DATA_QUALITY.md`

The CP-19 packet is blocked until the CP-18 closeout PR is merged and the
resulting `PROJECT_STATUS.md` on `main` explicitly closes CP-18.

