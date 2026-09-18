import { PageHeader } from '../../components/PageHeader'
import { useMeQuery } from '../auth/authApi'
import { LearnerTraining } from './LearnerTraining'
import { StaffTraining } from './StaffTraining'

export function TrainingPage() {
  const { data: me } = useMeQuery()
  const role = me?.memberships[0]?.role
  const isStaff = role === 'tenant_admin' || role === 'instructor'
  const isLearner = role === 'learner'

  return (
    <>
      <PageHeader
        title={isLearner ? 'My training' : 'Training'}
        subtitle={
          me
            ? me.email
            : isLearner
              ? 'Your assigned videos'
              : 'Assignments and progress'
        }
      />

      {isStaff ? <StaffTraining /> : null}
      {isLearner ? <LearnerTraining /> : null}
      {!isStaff && !isLearner ? (
        <p className="text-muted text-sm">
          Training is unavailable for this account (no workspace role).
        </p>
      ) : null}
    </>
  )
}
