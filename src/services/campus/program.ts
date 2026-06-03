import {ProgramCompletion, ProgramFull} from '../../domain/program';

export async function getDegreeProgramCompletion(): Promise<ProgramCompletion> {
  const program: ProgramCompletion = {
    completedCredit: 0,
    compulsoryCredit: 0,
    restrictedCredit: 0,
    electiveCredit: 0,
    duplicatedCourse: [],
    courseSet: [],
  };

  return program;
}

export async function getFullDegreeProgram(_degreeId?: number): Promise<ProgramFull> {
  const program: ProgramFull = {
    courseSet: [],
  };

  return program;
}
