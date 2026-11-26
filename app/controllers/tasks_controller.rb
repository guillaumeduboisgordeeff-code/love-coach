class TasksController < ApplicationController # Définit le contrôleur des tâches.
  def update # Gère la modification d’une tâche via l’action update.
    @masterplan = current_user.masterplans.find(params[:masterplan_id]) # Trouve un masterplan appartenant à l’utilisateur connecté.
    @task = @masterplan.tasks.find(params[:id]) # Trouve la tâche dans ce masterplan.
    @task.update(task_params) # Enregistre les paramètres autorisés.
    redirect_to masterplan_path(@masterplan) # Revient à la page du masterplan.
  end # Termine l’action update.

  def mark_as_done # Gère le changement d’état envoyé par la case à cocher.
    @masterplan = current_user.masterplans.joins(:tasks).find_by!(tasks: { id: params[:id] }) # Vérifie que la tâche appartient à un masterplan de l’utilisateur connecté.
    @task = @masterplan.tasks.find(params[:id]) # Retrouve la tâche dans ce masterplan.
    @task.update!(done: params[:done] == "true") # Lit le paramètre done et le convertit en true ou false.
    redirect_to masterplan_path(@masterplan) # Revient à la page du masterplan.
  end # Termine l’action mark_as_done.

  private # Commence les méthodes privées.

  def task_params # Définit les paramètres autorisés pour l’action update.
    params.require(:task).permit(:done) # Autorise uniquement la modification de done.
  end # Termine la méthode task_params.
end # Termine le contrôleur.
