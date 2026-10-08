export function PageHead(props: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{props.title}</h1>
        {props.description && <p>{props.description}</p>}
      </div>
      {props.action}
    </div>
  );
}
